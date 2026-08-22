import { Router, Request, Response, NextFunction } from 'express';
import { query, checkDbConnection, isDbConfigured } from './db';

const router = Router();

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const LOOSE_UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidUuid(id: string): boolean {
  return typeof id === 'string' && (UUID_REGEX.test(id) || LOOSE_UUID_REGEX.test(id));
}

// Health check endpoint (accessible at /health and /api/health)
export async function handleHealthCheck(req: Request, res: Response) {
  try {
    const dbStatus = await checkDbConnection();
    const hasGithub = Boolean(
      process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      !process.env.GITHUB_CLIENT_ID.includes('your_')
    );

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        configured: isDbConfigured(),
        connected: dbStatus.connected,
        ...(dbStatus.error ? { error: dbStatus.error } : {}),
      },
      env: {
        github_configured: hasGithub,
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      },
    });
  } catch (error: any) {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        configured: isDbConfigured(),
        connected: false,
        error: error.message || 'Database check failed',
      },
      env: {
        github_configured: false,
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      },
    });
  }
}

router.get('/health', handleHealthCheck);

// POST /api/devices/register
// Body: { device_id, fcm_token, app_version, platform }
// Upsert by device_id: insert if new, update fcm_token/last_seen_at if it already exists
router.post('/devices/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { device_id, fcm_token, app_version, platform } = req.body || {};

    if (!device_id || typeof device_id !== 'string') {
      res.status(400).json({
        error: 'Missing required field: "device_id" (UUID string is required)',
      });
      return;
    }

    if (!isValidUuid(device_id.trim())) {
      res.status(400).json({
        error: 'Invalid "device_id": must be a valid UUID format (e.g. 123e4567-e89b-12d3-a456-426614174000)',
      });
      return;
    }

    if (!fcm_token || typeof fcm_token !== 'string' || fcm_token.trim() === '') {
      res.status(400).json({
        error: 'Missing required field: "fcm_token" (non-empty string is required)',
      });
      return;
    }

    const cleanDeviceId = device_id.trim();
    const cleanFcmToken = fcm_token.trim();
    const cleanAppVersion = typeof app_version === 'string' && app_version.trim() !== '' ? app_version.trim() : null;
    const cleanPlatform = typeof platform === 'string' && platform.trim() !== '' ? platform.trim() : 'android';

    const upsertQuery = `
      INSERT INTO device_registrations (device_id, fcm_token, app_version, platform, last_seen_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (device_id)
      DO UPDATE SET
          fcm_token = EXCLUDED.fcm_token,
          app_version = COALESCE(EXCLUDED.app_version, device_registrations.app_version),
          platform = COALESCE(EXCLUDED.platform, device_registrations.platform),
          last_seen_at = NOW()
      RETURNING *;
    `;

    const result = await query(upsertQuery, [
      cleanDeviceId,
      cleanFcmToken,
      cleanAppVersion,
      cleanPlatform,
    ]);

    const device = result.rows[0];
    res.status(200).json({
      success: true,
      message: 'Device registration saved successfully',
      device,
    });
  } catch (error: any) {
    console.error('Error in /api/devices/register:', error);
    if (error.message && error.message.includes('Database is not configured')) {
      res.status(503).json({
        error: 'Database is not configured. Please set DATABASE_URL with a valid Neon PostgreSQL connection string.',
      });
      return;
    }
    res.status(500).json({
      error: error.message || 'Internal Server Error during device registration',
    });
  }
});

// POST /api/devices/link-user
// Body: { device_id, user_id }
// Updates the matching row's user_id
router.post('/devices/link-user', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { device_id, user_id } = req.body || {};

    if (!device_id || typeof device_id !== 'string') {
      res.status(400).json({
        error: 'Missing required field: "device_id" (UUID string is required)',
      });
      return;
    }

    if (!isValidUuid(device_id.trim())) {
      res.status(400).json({
        error: 'Invalid "device_id": must be a valid UUID format',
      });
      return;
    }

    let parsedUserId: number | null = null;
    if (user_id !== undefined && user_id !== null && user_id !== '') {
      const num = Number(user_id);
      if (isNaN(num) || !Number.isInteger(num)) {
        res.status(400).json({
          error: 'Invalid "user_id": must be an integer or null',
        });
        return;
      }
      parsedUserId = num;
    }

    const cleanDeviceId = device_id.trim();

    const updateQuery = `
      UPDATE device_registrations
      SET user_id = $2, last_seen_at = NOW()
      WHERE device_id = $1
      RETURNING *;
    `;

    const result = await query(updateQuery, [cleanDeviceId, parsedUserId]);

    if (result.rowCount === 0) {
      res.status(404).json({
        error: `Device not found with device_id: ${cleanDeviceId}`,
      });
      return;
    }

    const device = result.rows[0];
    res.status(200).json({
      success: true,
      message: 'User linked to device successfully',
      device,
    });
  } catch (error: any) {
    console.error('Error in /api/devices/link-user:', error);
    if (error.message && error.message.includes('Database is not configured')) {
      res.status(503).json({
        error: 'Database is not configured. Please set DATABASE_URL with a valid Neon PostgreSQL connection string.',
      });
      return;
    }
    res.status(500).json({
      error: error.message || 'Internal Server Error during user link',
    });
  }
});

// GET /api/devices (List devices for developer inspect/dashboard)
router.get('/devices', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const listQuery = `
      SELECT id, device_id, fcm_token, user_id, platform, app_version, installed_at, last_seen_at
      FROM device_registrations
      ORDER BY last_seen_at DESC
      LIMIT 50;
    `;
    const result = await query(listQuery);
    res.status(200).json({
      success: true,
      count: result.rowCount,
      devices: result.rows,
    });
  } catch (error: any) {
    if (error.message && error.message.includes('Database is not configured')) {
      res.status(503).json({
        error: 'Database is not configured. Please set DATABASE_URL.',
        devices: [],
      });
      return;
    }
    res.status(500).json({
      error: error.message || 'Failed to fetch devices',
      devices: [],
    });
  }
});

// POST /api/github/exchange-token
// Body: { code }
// Calls GitHub's https://github.com/login/oauth/access_token with client_id and client_secret
// Returns { access_token } on success, or { error } message on failure — NEVER exposes client secret
router.post('/github/exchange-token', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code } = req.body || {};

    if (!code || typeof code !== 'string' || code.trim() === '') {
      res.status(400).json({
        error: 'Missing required field: "code" (OAuth authorization code from GitHub)',
      });
      return;
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId.includes('your_') || clientSecret.includes('your_')) {
      res.status(500).json({
        error: 'GitHub OAuth is not configured on this server. GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set in environment variables.',
      });
      return;
    }

    const cleanCode = code.trim();

    const githubResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Node-Express-Neon-Device-Backend',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: cleanCode,
      }),
    });

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error('GitHub token exchange HTTP error:', githubResponse.status, errorText);
      res.status(githubResponse.status).json({
        error: `GitHub OAuth server returned HTTP ${githubResponse.status}`,
      });
      return;
    }

    const data: any = await githubResponse.json();

    if (data.error) {
      res.status(400).json({
        error: data.error_description || data.error || 'GitHub token exchange failed',
        error_code: data.error,
      });
      return;
    }

    if (!data.access_token) {
      res.status(400).json({
        error: 'No access token returned by GitHub. The authorization code may have expired or is invalid.',
      });
      return;
    }

    // Return access_token, token_type, scope safely without exposing client_secret
    res.status(200).json({
      access_token: data.access_token,
      token_type: data.token_type || 'bearer',
      scope: data.scope || '',
    });
  } catch (error: any) {
    console.error('Error in /api/github/exchange-token:', error);
    res.status(500).json({
      error: error.message || 'Internal server error during GitHub token exchange',
    });
  }
});

export default router;
