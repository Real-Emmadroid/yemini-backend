import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting scoped strictly to the Yemini router
const yeminiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per IP per window across all Yemini routes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', detail: 'Too many requests. Please try again later.' },
});

router.use(yeminiRateLimiter);

// Shared app-secret check scoped strictly to the Yemini router
router.use((req: Request, res: Response, next: NextFunction) => {
  const providedSecret = req.header('X-App-Secret');
  const expectedSecret = process.env.APP_SHARED_SECRET;
  if (!expectedSecret) {
    console.warn('[yemini] APP_SHARED_SECRET not configured — rejecting all requests for safety');
    res.status(503).json({ error: 'server_misconfigured' });
    return;
  }
  if (providedSecret !== expectedSecret) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
});

// Configure multer for memory storage with a 50MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
});

interface ProviderError {
  provider: string;
  error: string;
}

// Utility: Sleep helper for polling loops
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// iLoveAPI Key Pool & Failover Management
// ============================================================================

// Key picker state
let nextKeyIndex = 0;
const cooldownUntil = new Map<number, number>();

// Retrieve configured keys without logging or exposing key values
function getIloveApiKeys(): string[] {
  const keysEnv = process.env.ILOVEPDF_KEYS;
  let keys: string[] = [];
  if (keysEnv && typeof keysEnv === 'string') {
    keys = keysEnv
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }
  if (keys.length === 0 && process.env.ILOVEPDF_SECRET_KEY) {
    const singleKey = process.env.ILOVEPDF_SECRET_KEY.trim();
    if (singleKey.length > 0) {
      keys = [singleKey];
    }
  }
  if (keys.length === 0) {
    throw new Error('No iLoveAPI keys configured');
  }
  return keys;
}

// Return key indexes starting round-robin from nextKeyIndex, moving cooling-down keys to the end
function getKeyOrder(): number[] {
  const keys = getIloveApiKeys();
  const n = keys.length;
  if (n === 0) return [];

  const startIndex = Math.abs(nextKeyIndex) % n;
  nextKeyIndex = (nextKeyIndex + 1) % n;

  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    order.push((startIndex + i) % n);
  }

  const now = Date.now();
  const active: number[] = [];
  const coolingDown: number[] = [];

  for (const idx of order) {
    const cooldownExpiry = cooldownUntil.get(idx);
    if (cooldownExpiry && cooldownExpiry > now) {
      coolingDown.push(idx);
    } else {
      active.push(idx);
    }
  }

  return [...active, ...coolingDown];
}

// ============================================================================
// 1. iLoveAPI Provider (iLovePDF REST API v1) - PDF to DOCX
// ============================================================================

async function convertSingleKeyWithILoveApi(
  fileBuffer: Buffer,
  fileName: string,
  apiKey: string
): Promise<Buffer> {
  // Step 1: Authenticate with public_key
  const authRes = await fetch('https://api.ilovepdf.com/v1/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: apiKey }),
  });

  if (!authRes.ok) {
    const errText = await authRes.text();
    const err: any = new Error(`iLoveAPI Auth failed (HTTP ${authRes.status}): ${errText}`);
    err.status = authRes.status;
    throw err;
  }

  const authData: any = await authRes.json();
  const token = authData?.token;
  if (!token) {
    const err: any = new Error('iLoveAPI Auth succeeded but no JWT token returned');
    err.status = 500;
    throw err;
  }

  // Step 2: Start task (try pdfoffice tool for PDF to Word/DOCX)
  let startRes = await fetch('https://api.ilovepdf.com/v1/start/pdfoffice', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  // Fallback to 'pdfword' tool if 'pdfoffice' returns 404 or error
  let toolName = 'pdfoffice';
  if (!startRes.ok && startRes.status === 404) {
    toolName = 'pdfword';
    startRes = await fetch('https://api.ilovepdf.com/v1/start/pdfword', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!startRes.ok) {
    const errText = await startRes.text();
    const err: any = new Error(`iLoveAPI Start task failed (HTTP ${startRes.status}): ${errText}`);
    err.status = startRes.status;
    throw err;
  }

  const startData: any = await startRes.json();
  const { server, task } = startData;
  if (!server || !task) {
    const err: any = new Error(`iLoveAPI Invalid start response: missing server (${server}) or task (${task})`);
    err.status = 500;
    throw err;
  }

  // Step 3: Upload file
  const uploadFormData = new FormData();
  uploadFormData.append('task', task);
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });
  uploadFormData.append('file', blob, fileName || 'document.pdf');

  const uploadRes = await fetch(`https://${server}/v1/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: uploadFormData,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    const err: any = new Error(`iLoveAPI Upload failed (HTTP ${uploadRes.status}): ${errText}`);
    err.status = uploadRes.status;
    throw err;
  }

  const uploadData: any = await uploadRes.json();
  const serverFilename = uploadData?.server_filename;
  if (!serverFilename) {
    const err: any = new Error('iLoveAPI Upload succeeded but server_filename is missing');
    err.status = 500;
    throw err;
  }

  // Step 4: Process conversion
  const processRes = await fetch(`https://${server}/v1/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task,
      tool: toolName,
      files: [
        {
          server_filename: serverFilename,
          filename: fileName || 'document.pdf',
        },
      ],
    }),
  });

  if (!processRes.ok) {
    const errText = await processRes.text();
    const err: any = new Error(`iLoveAPI Process failed (HTTP ${processRes.status}): ${errText}`);
    err.status = processRes.status;
    throw err;
  }

  // Step 5: Download converted file
  const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!downloadRes.ok) {
    const errText = await downloadRes.text();
    const err: any = new Error(`iLoveAPI Download failed (HTTP ${downloadRes.status}): ${errText}`);
    err.status = downloadRes.status;
    throw err;
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Convert PDF to DOCX with multi-key failover
async function convertWithILoveApi(fileBuffer: Buffer, fileName: string): Promise<Buffer> {
  const keys = getIloveApiKeys();
  const keyOrder = getKeyOrder();
  let lastError: any = null;

  for (const keyIndex of keyOrder) {
    const apiKey = keys[keyIndex];
    try {
      return await convertSingleKeyWithILoveApi(fileBuffer, fileName, apiKey);
    } catch (err: any) {
      lastError = err;
      if (err.isPasswordRequired || [400, 404, 409, 413, 422].includes(err.status)) {
        throw err;
      }

      const statusText = err.status ? String(err.status) : (err.message || 'error');
      if ([401, 402, 403, 429].includes(err.status)) {
        cooldownUntil.set(keyIndex, Date.now() + 60 * 60 * 1000); // 60 minutes
        console.warn(`[Yemini] iLoveAPI key #${keyIndex + 1} failed (${err.status}), trying next`);
        continue;
      }

      // Any other error (5xx, network, etc.)
      cooldownUntil.set(keyIndex, Date.now() + 60 * 1000); // 1 minute
      console.warn(`[Yemini] iLoveAPI key #${keyIndex + 1} failed (${statusText}), trying next`);
      continue;
    }
  }

  throw lastError || new Error('All iLoveAPI keys failed');
}

// ============================================================================
// Shared iLoveAPI Task Runner for PDF Tools and Image Tools
// ============================================================================

// iLovePDF and iLoveIMG share account keys and the same auth/start/upload/process/download flow;
// only the API host differs.
type IloveApiHost = 'ilovepdf' | 'iloveimg';

async function runIloveApiTask(
  tool: string,
  files: Express.Multer.File[],
  extraParams: Record<string, any> = {},
  host: IloveApiHost = 'ilovepdf',
  apiKey: string
): Promise<{ buffer: Buffer; filename: string }> {
  const apiBase = `https://api.${host}.com/v1`;

  const authResp = await fetch(`${apiBase}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: apiKey }),
  });
  if (!authResp.ok) {
    const err: any = new Error(`iLoveAPI auth failed: ${authResp.status}`);
    err.status = authResp.status;
    throw err;
  }
  const { token } = (await authResp.json()) as any;

  const startResp = await fetch(`${apiBase}/start/${tool}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!startResp.ok) {
    const errText = await startResp.text();
    const err: any = new Error(`iLoveAPI start failed for tool "${tool}": ${startResp.status} ${errText}`);
    err.status = startResp.status;
    throw err;
  }
  const { server, task } = (await startResp.json()) as any;

  const uploadedFiles: { server_filename: string; filename: string }[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append('task', task);
    form.append('file', new Blob([new Uint8Array(file.buffer)]), file.originalname);
    const uploadResp = await fetch(`https://${server}/v1/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!uploadResp.ok) {
      const err: any = new Error(`iLoveAPI upload failed: ${uploadResp.status}`);
      err.status = uploadResp.status;
      throw err;
    }
    const { server_filename } = (await uploadResp.json()) as any;
    uploadedFiles.push({ server_filename, filename: file.originalname });
  }

  const processResp = await fetch(`https://${server}/v1/process`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, tool, files: uploadedFiles, ...extraParams }),
  });
  if (!processResp.ok) {
    const body = await processResp.text();
    if (processResp.status === 400 && body.includes('WrongPassword')) {
      const err: any = new Error('password_required');
      err.isPasswordRequired = true;
      err.status = 400;
      throw err;
    }
    const err: any = new Error(`iLoveAPI process failed for "${tool}": ${processResp.status} ${body}`);
    err.status = processResp.status;
    throw err;
  }

  const downloadResp = await fetch(`https://${server}/v1/download/${task}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!downloadResp.ok) {
    const err: any = new Error(`iLoveAPI download failed: ${downloadResp.status}`);
    err.status = downloadResp.status;
    throw err;
  }
  const buffer = Buffer.from(await downloadResp.arrayBuffer());
  const contentDisposition = downloadResp.headers.get('content-disposition') || '';
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
  return { buffer, filename: filenameMatch?.[1] || `output_${tool}` };
}

// Multi-key failover wrapper for PDF and Image tools
async function runWithKeyFailover(
  tool: string,
  files: Express.Multer.File[],
  extraParams: Record<string, any> = {},
  host: IloveApiHost = 'ilovepdf'
): Promise<{ buffer: Buffer; filename: string }> {
  const keys = getIloveApiKeys();
  const keyOrder = getKeyOrder();
  let lastError: any = null;

  for (const keyIndex of keyOrder) {
    const apiKey = keys[keyIndex];
    try {
      return await runIloveApiTask(tool, files, extraParams, host, apiKey);
    } catch (err: any) {
      lastError = err;
      if (err.isPasswordRequired || [400, 404, 409, 413, 422].includes(err.status)) {
        throw err;
      }

      const statusText = err.status ? String(err.status) : (err.message || 'error');
      if ([401, 402, 403, 429].includes(err.status)) {
        cooldownUntil.set(keyIndex, Date.now() + 60 * 60 * 1000); // 60 minutes
        console.warn(`[Yemini] iLoveAPI key #${keyIndex + 1} failed (${err.status}), trying next`);
        continue;
      }

      // Any other error (5xx, network, etc.)
      cooldownUntil.set(keyIndex, Date.now() + 60 * 1000); // 1 minute
      console.warn(`[Yemini] iLoveAPI key #${keyIndex + 1} failed (${statusText}), trying next`);
      continue;
    }
  }

  throw lastError || new Error('All iLoveAPI keys failed');
}

// Helper to execute and format response for PDF Tool endpoints
async function handlePdfToolExecution(
  tool: string,
  req: Request,
  res: Response,
  extraParams: Record<string, any> = {},
  defaultContentType = 'application/pdf',
  host: IloveApiHost = 'ilovepdf'
): Promise<void> {
  const files = req.files as Express.Multer.File[];
  if (!files || !Array.isArray(files) || files.length === 0) {
    res.status(400).json({
      error: 'Missing required files: "files" field in multipart/form-data is required',
    });
    return;
  }

  try {
    const result = await runWithKeyFailover(tool, files, extraParams, host);

    let contentType = defaultContentType;
    const lowerFilename = result.filename.toLowerCase();
    if (lowerFilename.endsWith('.zip')) {
      contentType = 'application/zip';
    } else if (lowerFilename.endsWith('.jpg') || lowerFilename.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (lowerFilename.endsWith('.png')) {
      contentType = 'image/png';
    } else if (lowerFilename.endsWith('.webp')) {
      contentType = 'image/webp';
    } else if (lowerFilename.endsWith('.gif')) {
      contentType = 'image/gif';
    } else if (lowerFilename.endsWith('.md')) {
      contentType = 'text/markdown; charset=utf-8';
    } else if (lowerFilename.endsWith('.txt')) {
      contentType = 'text/plain; charset=utf-8';
    } else if (lowerFilename.endsWith('.json')) {
      contentType = 'application/json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Output-Filename', result.filename);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.buffer);
  } catch (err: any) {
    if (err.isPasswordRequired || err.message === 'password_required') {
      res.status(409).json({ error: 'password_required' });
      return;
    }
    console.error(`[Yemini PDF Tools] Tool "${tool}" failed:`, err);
    res.status(502).json({
      error: 'pdf_tool_failed',
      tool,
      detail: err.message || 'Unknown error during PDF tool execution',
    });
  }
}

// ============================================================================
// 2. Nutrient Provider (formerly PSPDFKit API)
// ============================================================================
async function convertWithNutrient(fileBuffer: Buffer, fileName: string): Promise<Buffer> {
  const apiKey = process.env.NUTRIENT_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('NUTRIENT_API_KEY is not configured in environment variables');
  }

  const formData = new FormData();
  formData.append(
    'instructions',
    JSON.stringify({
      parts: [{ file: 'document' }],
      output: { type: 'docx' },
    })
  );

  const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });
  formData.append('document', blob, fileName || 'document.pdf');

  const res = await fetch('https://api.nutrient.io/build', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Nutrient API failed (HTTP ${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================================
// 3. CloudConvert Provider
// ============================================================================
async function convertWithCloudConvert(fileBuffer: Buffer, fileName: string): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('CLOUDCONVERT_API_KEY is not configured in environment variables');
  }

  // Step 1: Create Job with import -> convert -> export tasks
  const createJobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tasks: {
        'import-file': {
          operation: 'import/upload',
        },
        'convert-file': {
          operation: 'convert',
          input: 'import-file',
          input_format: 'pdf',
          output_format: 'docx',
        },
        'export-file': {
          operation: 'export/url',
          input: 'convert-file',
        },
      },
    }),
  });

  if (!createJobRes.ok) {
    const errText = await createJobRes.text();
    throw new Error(`CloudConvert Create Job failed (HTTP ${createJobRes.status}): ${errText}`);
  }

  const jobData: any = await createJobRes.json();
  const jobId = jobData?.data?.id;
  const tasks: any[] = jobData?.data?.tasks || [];
  const importTask = tasks.find((t) => t.name === 'import-file' || t.operation === 'import/upload');

  if (!jobId || !importTask || !importTask.result?.form?.url) {
    throw new Error('CloudConvert Job created but import upload form details are missing');
  }

  const uploadFormUrl = importTask.result.form.url;
  const uploadFormParams = importTask.result.form.parameters || {};

  // Step 2: Upload file to CloudConvert upload URL
  const uploadFormData = new FormData();
  for (const [key, value] of Object.entries(uploadFormParams)) {
    uploadFormData.append(key, String(value));
  }
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });
  uploadFormData.append('file', blob, fileName || 'document.pdf');

  const uploadRes = await fetch(uploadFormUrl, {
    method: 'POST',
    body: uploadFormData,
  });

  if (!uploadRes.ok && uploadRes.status !== 204 && uploadRes.status !== 201) {
    const errText = await uploadRes.text();
    throw new Error(`CloudConvert File Upload failed (HTTP ${uploadRes.status}): ${errText}`);
  }

  // Step 3: Poll Job status until finished (max 60 seconds)
  const maxAttempts = 40;
  let exportFileUrl: string | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await delay(1500);

    const pollRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });

    if (!pollRes.ok) {
      const errText = await pollRes.text();
      throw new Error(`CloudConvert Polling failed (HTTP ${pollRes.status}): ${errText}`);
    }

    const pollData: any = await pollRes.json();
    const currentJob = pollData?.data;
    const status = currentJob?.status;

    if (status === 'error') {
      const failedTask = currentJob?.tasks?.find((t: any) => t.status === 'error');
      const msg = failedTask?.message || failedTask?.code || 'Unknown CloudConvert error';
      throw new Error(`CloudConvert conversion job failed: ${msg}`);
    }

    if (status === 'finished') {
      const exportTask = currentJob?.tasks?.find(
        (t: any) => t.name === 'export-file' || t.operation === 'export/url'
      );
      const files = exportTask?.result?.files;
      if (files && files.length > 0 && files[0]?.url) {
        exportFileUrl = files[0].url;
        break;
      }
      throw new Error('CloudConvert job finished but no export file URL was found');
    }
  }

  if (!exportFileUrl) {
    throw new Error('CloudConvert conversion timed out after 60 seconds');
  }

  // Step 4: Download result DOCX bytes
  const downloadRes = await fetch(exportFileUrl);
  if (!downloadRes.ok) {
    throw new Error(`CloudConvert Download export file failed (HTTP ${downloadRes.status})`);
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================================
// 4. Adobe PDF Services Provider
// ============================================================================
async function convertWithAdobe(fileBuffer: Buffer, fileName: string): Promise<Buffer> {
  const clientId = process.env.ADOBE_CLIENT_ID;
  const clientSecret = process.env.ADOBE_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.trim() === '' || clientSecret.trim() === '') {
    throw new Error('ADOBE_CLIENT_ID or ADOBE_CLIENT_SECRET is not configured in environment variables');
  }

  // Step 1: Obtain IMS OAuth Access Token via client_credentials
  const tokenParams = new URLSearchParams({
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    grant_type: 'client_credentials',
    scope: 'openid,AdobeID,read_organizations,additional_info.projectedProductContext',
  });

  let tokenRes = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  });

  // Fallback to simplified scope if the extended scope is rejected
  if (!tokenRes.ok) {
    const fallbackParams = new URLSearchParams({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      grant_type: 'client_credentials',
      scope: 'openid,AdobeID,additional_info.projectedProductContext',
    });
    tokenRes = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fallbackParams.toString(),
    });
  }

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Adobe IMS OAuth Token generation failed (HTTP ${tokenRes.status}): ${errText}`);
  }

  const tokenData: any = await tokenRes.json();
  const accessToken = tokenData?.access_token;
  if (!accessToken) {
    throw new Error('Adobe IMS OAuth succeeded but no access_token was returned');
  }

  const adobeHeaders = {
    'x-api-key': clientId.trim(),
    Authorization: `Bearer ${accessToken}`,
  };

  // Step 2: Create an Asset
  const createAssetRes = await fetch('https://pdf-services.adobe.io/assets', {
    method: 'POST',
    headers: {
      ...adobeHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mediaType: 'application/pdf' }),
  });

  if (!createAssetRes.ok) {
    const errText = await createAssetRes.text();
    throw new Error(`Adobe Create Asset failed (HTTP ${createAssetRes.status}): ${errText}`);
  }

  const assetData: any = await createAssetRes.json();
  const assetID = assetData?.assetID;
  const uploadUri = assetData?.uploadUri;

  if (!assetID || !uploadUri) {
    throw new Error('Adobe Create Asset response missing assetID or uploadUri');
  }

  // Step 3: Upload the PDF file to uploadUri
  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Adobe Asset Upload failed (HTTP ${uploadRes.status}): ${errText}`);
  }

  // Step 4: Kick off PDF Export Job (targetFormat: docx)
  const exportRes = await fetch('https://pdf-services.adobe.io/operation/exportpdf', {
    method: 'POST',
    headers: {
      ...adobeHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assetID,
      targetFormat: 'docx',
    }),
  });

  if (!exportRes.ok && exportRes.status !== 201 && exportRes.status !== 202) {
    const errText = await exportRes.text();
    throw new Error(`Adobe Export Job creation failed (HTTP ${exportRes.status}): ${errText}`);
  }

  const locationHeader = exportRes.headers.get('location') || exportRes.headers.get('Location');
  let pollUrl = locationHeader;

  if (!pollUrl) {
    const exportData: any = await exportRes.json().catch(() => ({}));
    pollUrl = exportData?.location || exportData?.statusUrl;
  }

  if (!pollUrl) {
    throw new Error('Adobe Export Job response did not include a Location header to poll status');
  }

  // If pollUrl is relative, prepend base URL
  if (pollUrl.startsWith('/')) {
    pollUrl = `https://pdf-services.adobe.io${pollUrl}`;
  }

  // Step 5: Poll status until 'done'
  const maxAttempts = 35;
  let downloadUri: string | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await delay(1500);

    const pollRes = await fetch(pollUrl, {
      method: 'GET',
      headers: adobeHeaders,
    });

    if (!pollRes.ok) {
      const errText = await pollRes.text();
      throw new Error(`Adobe Job Polling failed (HTTP ${pollRes.status}): ${errText}`);
    }

    const pollData: any = await pollRes.json();
    const status = pollData?.status;

    if (status === 'failed') {
      const reason = pollData?.error?.message || JSON.stringify(pollData?.error) || 'Unknown Adobe error';
      throw new Error(`Adobe PDF Export operation failed: ${reason}`);
    }

    if (status === 'done') {
      downloadUri = pollData?.asset?.downloadUri || pollData?.content?.downloadUri || pollData?.downloadUri;
      if (downloadUri) {
        break;
      }
      throw new Error('Adobe Job status is done, but downloadUri is missing');
    }
  }

  if (!downloadUri) {
    throw new Error('Adobe PDF conversion timed out after 50 seconds');
  }

  // Step 6: Download converted DOCX file
  const downloadRes = await fetch(downloadUri);
  if (!downloadRes.ok) {
    throw new Error(`Adobe Download Result failed (HTTP ${downloadRes.status})`);
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================================
// Routes
// ============================================================================

// GET /api/yemini/health (Diagnostic endpoint)
router.get('/health', (req: Request, res: Response): void => {
  let keysCount = 0;
  let coolingCount = 0;
  try {
    const keys = getIloveApiKeys();
    keysCount = keys.length;
    const now = Date.now();
    coolingCount = Array.from(cooldownUntil.values()).filter((expiry) => expiry > now).length;
  } catch {
    keysCount = 0;
    coolingCount = 0;
  }

  const providers = {
    iloveapi: keysCount > 0,
    nutrient: Boolean(
      process.env.NUTRIENT_API_KEY &&
      process.env.NUTRIENT_API_KEY.trim() !== '' &&
      !process.env.NUTRIENT_API_KEY.includes('your_')
    ),
    cloudconvert: Boolean(
      process.env.CLOUDCONVERT_API_KEY &&
      process.env.CLOUDCONVERT_API_KEY.trim() !== '' &&
      !process.env.CLOUDCONVERT_API_KEY.includes('your_')
    ),
    adobe: Boolean(
      process.env.ADOBE_CLIENT_ID &&
      process.env.ADOBE_CLIENT_SECRET &&
      process.env.ADOBE_CLIENT_ID.trim() !== '' &&
      process.env.ADOBE_CLIENT_SECRET.trim() !== '' &&
      !process.env.ADOBE_CLIENT_ID.includes('your_')
    ),
  };

  const configuredCount = Object.values(providers).filter(Boolean).length;

  res.status(200).json({
    status: 'ok',
    service: 'yemini-converter',
    timestamp: new Date().toISOString(),
    configured_providers_count: configuredCount,
    providers,
    ilovepdf: {
      keysConfigured: keysCount,
      keysCoolingDown: coolingCount,
    },
    fallback_order: ['iloveapi', 'cloudconvert', 'adobe', 'nutrient'],
  });
});

// POST /api/yemini/convert-pdf-to-docx (4-Provider Fallback Chain)
router.post(
  '/convert-pdf-to-docx',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;

    if (!file || !file.buffer || file.buffer.length === 0) {
      res.status(400).json({
        error: 'Missing required file: "file" field in multipart/form-data is required',
      });
      return;
    }

    const originalName = file.originalname || 'document.pdf';
    const providerErrors: ProviderError[] = [];

    console.log(`[Yemini Converter] Received conversion request for: ${originalName} (${file.size} bytes)`);

    // Chain 1: iLoveAPI (with multi-key failover)
    try {
      console.log('[Yemini Converter] [1/4] Trying iLoveAPI...');
      const docxBuffer = await convertWithILoveApi(file.buffer, originalName);
      console.log('[Yemini Converter] ✅ iLoveAPI conversion succeeded.');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('X-Conversion-Provider', 'iloveapi');
      res.setHeader('Content-Disposition', `attachment; filename="${originalName.replace(/\.pdf$/i, '')}.docx"`);
      res.status(200).send(docxBuffer);
      return;
    } catch (err: any) {
      const message = err.message || 'Unknown error in iLoveAPI provider';
      console.warn(`[Yemini Converter] ⚠️ iLoveAPI failed: ${message}`);
      providerErrors.push({ provider: 'iloveapi', error: message });
    }

    // Chain 2: CloudConvert
    try {
      console.log('[Yemini Converter] [2/4] Trying CloudConvert...');
      const docxBuffer = await convertWithCloudConvert(file.buffer, originalName);
      console.log('[Yemini Converter] ✅ CloudConvert conversion succeeded.');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('X-Conversion-Provider', 'cloudconvert');
      res.setHeader('Content-Disposition', `attachment; filename="${originalName.replace(/\.pdf$/i, '')}.docx"`);
      res.status(200).send(docxBuffer);
      return;
    } catch (err: any) {
      const message = err.message || 'Unknown error in CloudConvert provider';
      console.warn(`[Yemini Converter] ⚠️ CloudConvert failed: ${message}`);
      providerErrors.push({ provider: 'cloudconvert', error: message });
    }

    // Chain 3: Adobe PDF Services
    try {
      console.log('[Yemini Converter] [3/4] Trying Adobe PDF Services...');
      const docxBuffer = await convertWithAdobe(file.buffer, originalName);
      console.log('[Yemini Converter] ✅ Adobe PDF Services conversion succeeded.');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('X-Conversion-Provider', 'adobe');
      res.setHeader('Content-Disposition', `attachment; filename="${originalName.replace(/\.pdf$/i, '')}.docx"`);
      res.status(200).send(docxBuffer);
      return;
    } catch (err: any) {
      const message = err.message || 'Unknown error in Adobe provider';
      console.warn(`[Yemini Converter] ⚠️ Adobe PDF Services failed: ${message}`);
      providerErrors.push({ provider: 'adobe', error: message });
    }

    // Chain 4: Nutrient
    // Last resort — free tier output is watermarked, see conversation notes.
    try {
      console.log('[Yemini Converter] [4/4] Trying Nutrient...');
      const docxBuffer = await convertWithNutrient(file.buffer, originalName);
      console.log('[Yemini Converter] ✅ Nutrient conversion succeeded.');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('X-Conversion-Provider', 'nutrient');
      res.setHeader('Content-Disposition', `attachment; filename="${originalName.replace(/\.pdf$/i, '')}.docx"`);
      res.status(200).send(docxBuffer);
      return;
    } catch (err: any) {
      const message = err.message || 'Unknown error in Nutrient provider';
      console.warn(`[Yemini Converter] ⚠️ Nutrient failed: ${message}`);
      providerErrors.push({ provider: 'nutrient', error: message });
    }

    // All 4 failed: Return 502 Bad Gateway with details for on-device fallback
    console.error('[Yemini Converter] ❌ All 4 PDF-to-DOCX conversion providers failed.');
    res.status(502).json({
      error: 'All 4 cloud conversion providers failed. Fallback to on-device conversion.',
      details: providerErrors,
      timestamp: new Date().toISOString(),
    });
  }
);

// ============================================================================
// PDF Tools Endpoints (/api/yemini/pdf/...)
// ============================================================================

// 1. Merge PDFs: tool: 'merge', file order = merge order
router.post('/pdf/merge', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  await handlePdfToolExecution('merge', req, res, {});
});

// 2. Split PDF: tool: 'split'
router.post('/pdf/split', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams: Record<string, any> = {};
  if (req.body.split_mode) extraParams.split_mode = req.body.split_mode;
  if (req.body.ranges) extraParams.ranges = req.body.ranges;
  await handlePdfToolExecution('split', req, res, extraParams);
});

// 3. Compress PDF: tool: 'compress'
router.post('/pdf/compress', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams = {
    compression_level: req.body.compression_level ?? 'recommended',
  };
  await handlePdfToolExecution('compress', req, res, extraParams);
});

// 4. Repair PDF: tool: 'repair'
router.post('/pdf/repair', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  await handlePdfToolExecution('repair', req, res, {});
});

// 5. Rotate PDF: tool: 'rotate'
router.post('/pdf/rotate', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams: Record<string, any> = {};
  if (req.body.rotate !== undefined) {
    extraParams.rotate = Number(req.body.rotate);
  }
  await handlePdfToolExecution('rotate', req, res, extraParams);
});

// 6. Unlock PDF: tool: 'unlock'
router.post('/pdf/unlock', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams: Record<string, any> = {};
  if (req.body.password) {
    extraParams.password = req.body.password;
  }
  await handlePdfToolExecution('unlock', req, res, extraParams);
});

// 7. Protect PDF: tool: 'protect' (password required)
router.post('/pdf/protect', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  if (!req.body.password || typeof req.body.password !== 'string' || req.body.password.trim() === '') {
    res.status(400).json({ error: 'password is required for protect tool' });
    return;
  }
  const extraParams = { password: req.body.password };
  await handlePdfToolExecution('protect', req, res, extraParams);
});

// 8. Convert to PDF/A: tool: 'pdfa'
router.post('/pdf/to-pdfa', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams = {
    conformance: req.body.conformance ?? 'pdfa-2b',
  };
  await handlePdfToolExecution('pdfa', req, res, extraParams);
});

// 9. Validate PDF/A: tool: 'validatepdfa'
router.post('/pdf/validate-pdfa', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams = {
    conformance: req.body.conformance ?? 'pdfa-2b',
  };
  await handlePdfToolExecution('validatepdfa', req, res, extraParams);
});

// 10. OCR PDF: tool: 'pdfocr'
router.post('/pdf/ocr', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  let ocrLanguages = ['eng'];
  if (req.body.ocr_languages) {
    try {
      ocrLanguages = typeof req.body.ocr_languages === 'string'
        ? JSON.parse(req.body.ocr_languages)
        : req.body.ocr_languages;
    } catch {
      ocrLanguages = [String(req.body.ocr_languages)];
    }
  }
  const extraParams = { ocr_languages: ocrLanguages };
  await handlePdfToolExecution('pdfocr', req, res, extraParams);
});

// 11. PDF to JPG: tool: 'pdfjpg'
router.post('/pdf/to-jpg', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams = {
    pdfjpg_mode: req.body.pdfjpg_mode ?? 'pages',
  };
  await handlePdfToolExecution('pdfjpg', req, res, extraParams, 'image/jpeg');
});

// 12. Page Numbers: tool: 'pagenumber'
router.post('/pdf/page-numbers', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams: Record<string, any> = {};
  if (req.body.vertical_position) extraParams.vertical_position = req.body.vertical_position;
  if (req.body.horizontal_position) extraParams.horizontal_position = req.body.horizontal_position;
  if (req.body.starting_number !== undefined) extraParams.starting_number = Number(req.body.starting_number);
  await handlePdfToolExecution('pagenumber', req, res, extraParams);
});

// 13. Watermark PDF: tool: 'watermark'
//
// The app's "transparency" is how see-through the stamp is (0 = solid, 100 = invisible).
// iLoveAPI's `transparency` is the opposite: 100 = fully opaque (default), so it is inverted here.
// iLoveAPI only positions on a 3x3 grid (vertical top/middle/bottom, horizontal left/center/right).
router.post('/pdf/watermark', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams: Record<string, any> = {
    mode: 'text',
    text: req.body.text ?? 'CONFIDENTIAL',
  };
  if (['top', 'middle', 'bottom'].includes(req.body.vertical_position)) {
    extraParams.vertical_position = req.body.vertical_position;
  }
  if (['left', 'center', 'right'].includes(req.body.horizontal_position)) {
    extraParams.horizontal_position = req.body.horizontal_position;
  }
  if (req.body.transparency !== undefined) {
    const seeThrough = Math.max(0, Math.min(100, Number(req.body.transparency) || 0));
    extraParams.transparency = 100 - seeThrough;
  }
  await handlePdfToolExecution('watermark', req, res, extraParams);
});

// 14. Extract Text: tool: 'extract'
router.post('/pdf/extract-text', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams = { detailed: true };
  await handlePdfToolExecution('extract', req, res, extraParams, 'text/plain; charset=utf-8');
});

// 15. PDF to Markdown: tool: 'pdfmarkdown'
router.post('/pdf/to-markdown', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  await handlePdfToolExecution('pdfmarkdown', req, res, {}, 'text/markdown; charset=utf-8');
});

// 16. Summarize PDF: tool: 'summarize'
router.post('/pdf/summarize', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams = {
    language: req.body.language ?? 'en',
    output_format: req.body.output_format ?? 'pdf',
  };
  await handlePdfToolExecution('summarize', req, res, extraParams);
});

// ============================================================================
// Image Tools Endpoints (/api/yemini/img/...)
// ============================================================================

// 1. Remove Background: tool: 'removebackgroundimage', host: 'iloveimg'
router.post('/img/remove-background', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  await handlePdfToolExecution('removebackgroundimage', req, res, {}, 'image/jpeg', 'iloveimg');
});

// 2. Resize Image: tool: 'resizeimage', host: 'iloveimg'
router.post('/img/resize', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams: Record<string, any> = {};

  const resizeMode = req.body.resize_mode ?? (req.body.percentage ? 'percent' : 'pixels');
  extraParams.resize_mode = resizeMode === 'percentage' ? 'percent' : resizeMode;

  if (extraParams.resize_mode === 'percent') {
    if (req.body.percentage !== undefined) {
      extraParams.percentage = Number(req.body.percentage);
    }
  } else {
    if (req.body.pixels_width !== undefined || req.body.width !== undefined) {
      extraParams.pixels_width = Number(req.body.pixels_width ?? req.body.width);
    }
    if (req.body.pixels_height !== undefined || req.body.height !== undefined) {
      extraParams.pixels_height = Number(req.body.pixels_height ?? req.body.height);
    }
    if (req.body.maintain_ratio !== undefined) {
      extraParams.maintain_ratio = req.body.maintain_ratio === true || req.body.maintain_ratio === 'true';
    }
    if (req.body.no_enlarge !== undefined) {
      extraParams.no_enlarge = req.body.no_enlarge === true || req.body.no_enlarge === 'true';
    }
  }

  await handlePdfToolExecution('resizeimage', req, res, extraParams, 'image/jpeg', 'iloveimg');
});

// Enhance (AI upscale): tool: 'upscaleimage', multiplier 2 or 4
router.post('/img/upscale', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const extraParams = { multiplier: Number(req.body.multiplier) === 4 ? 4 : 2 };
  await handlePdfToolExecution('upscaleimage', req, res, extraParams, 'image/jpeg', 'iloveimg');
});

// Compress: tool: 'compressimage'
router.post('/img/compress', upload.array('files'), async (req: Request, res: Response): Promise<void> => {
  const level = ['low', 'recommended', 'extreme'].includes(req.body.compression_level)
    ? req.body.compression_level
    : 'recommended';
  await handlePdfToolExecution('compressimage', req, res, { compression_level: level }, 'image/jpeg', 'iloveimg');
});

export default router;
