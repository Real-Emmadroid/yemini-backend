import React, { useState, useEffect, useCallback } from 'react';
import { YeminiHealthResponse } from '../types';

export const YeminiConverterPanel: React.FC = () => {
  const [appSecret, setAppSecret] = useState<string>(() => localStorage.getItem('yemini_app_secret') || '');
  const [health, setHealth] = useState<YeminiHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // File conversion state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionError, setConversionError] = useState<any | null>(null);
  const [successfulProvider, setSuccessfulProvider] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>('converted.docx');
  const [conversionDuration, setConversionDuration] = useState<number | null>(null);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const headers: Record<string, string> = {};
      if (appSecret.trim()) {
        headers['X-App-Secret'] = appSecret.trim();
      }
      const res = await fetch('/api/yemini/health', { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error('401 Unauthorized: Invalid or missing X-App-Secret header');
        } else if (res.status === 503) {
          throw new Error('503 Service Unavailable: APP_SHARED_SECRET not set in server environment');
        } else if (res.status === 429) {
          throw new Error('429 Rate Limited: Too many requests on /api/yemini/*');
        }
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to fetch Yemini health`);
      }
      const data: YeminiHealthResponse = await res.json();
      setHealth(data);
    } catch (err: any) {
      setHealthError(err.message || 'Error reaching /api/yemini/health');
    } finally {
      setHealthLoading(false);
    }
  }, [appSecret]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleSecretChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAppSecret(val);
    localStorage.setItem('yemini_app_secret', val);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setConversionError(null);
      setSuccessfulProvider(null);
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
      }
    }
  };

  const handleCreateSamplePdf = () => {
    // Generate a minimal valid PDF 1.4 document in memory for testing
    const samplePdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 58 >>
stream
BT
/F1 24 Tf
100 700 Td
(Yemini Converter Test Document) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000352 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
424
%%EOF`;

    const blob = new Blob([samplePdfContent], { type: 'application/pdf' });
    const testFile = new File([blob], 'sample-document.pdf', { type: 'application/pdf' });
    setSelectedFile(testFile);
    setConversionError(null);
    setSuccessfulProvider(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsConverting(true);
    setConversionError(null);
    setSuccessfulProvider(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const headers: Record<string, string> = {};
      if (appSecret.trim()) {
        headers['X-App-Secret'] = appSecret.trim();
      }

      const res = await fetch('/api/yemini/convert-pdf-to-docx', {
        method: 'POST',
        headers,
        body: formData,
      });

      const provider = res.headers.get('X-Conversion-Provider');
      const duration = Date.now() - startTime;
      setConversionDuration(duration);

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const outName = selectedFile.name.replace(/\.pdf$/i, '') + '.docx';
        setDownloadUrl(url);
        setDownloadFilename(outName);
        setSuccessfulProvider(provider || 'Unknown Provider');
      } else {
        const errorJson = await res.json().catch(() => ({
          error: `HTTP ${res.status}: Conversion request failed`,
        }));
        setConversionError(errorJson);
      }
    } catch (err: any) {
      setConversionError({
        error: err.message || 'Network error during conversion request',
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div id="panel-yemini-converter" className="space-y-6">
      {/* Client App-Secret Configuration Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-800 tracking-tight mb-1">
              Shared App Secret (<code className="font-mono text-slate-900">X-App-Secret</code>)
            </label>
            <p className="text-[11px] text-slate-500">
              Protects all <code className="font-mono text-slate-700">/api/yemini/*</code> endpoints (rate limit: 30 req / 15m). Matches <code className="font-mono text-slate-700">APP_SHARED_SECRET</code> in environment.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:w-80">
            <input
              id="input-yemini-secret"
              type="password"
              placeholder="Paste APP_SHARED_SECRET..."
              value={appSecret}
              onChange={handleSecretChange}
              className="flex-1 px-3 py-1.5 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:border-slate-800"
            />
            <button
              id="btn-apply-secret-test"
              onClick={fetchHealth}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
            >
              Test
            </button>
          </div>
        </div>
      </div>
      {/* Overview & Diagnostics */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Yemini PDF→DOCX Cloud Converter</span>
              <span className="text-[11px] px-2 py-0.5 rounded font-mono font-medium bg-emerald-100 text-emerald-800">
                Isolated Service Prefix: /api/yemini/*
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              4-Provider Fallback Chain: <strong className="text-slate-800">iLoveAPI</strong> → <strong className="text-slate-800">CloudConvert</strong> → <strong className="text-slate-800">Adobe PDF Services</strong> → <strong className="text-slate-800">Nutrient</strong>. First success wins; returns HTTP 502 if all fail so the client app triggers on-device conversion.
            </p>
          </div>

          <button
            id="btn-refresh-yemini-health"
            onClick={fetchHealth}
            disabled={healthLoading}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors self-start sm:self-auto flex items-center gap-1.5"
          >
            {healthLoading ? 'Checking...' : 'Check Diagnostics'}
          </button>
        </div>

        {healthError ? (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
            <span className="font-semibold">Diagnostic Error:</span> {healthError}
          </div>
        ) : health ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono border-b border-slate-100 pb-2">
              <span>Endpoint: <code className="text-slate-800 font-bold">GET /api/yemini/health</code></span>
              <span>
                Configured Providers: <strong className="text-slate-900">{health.configured_providers_count} of 4</strong>
              </span>
            </div>

            {/* Provider Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. iLoveAPI */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 font-mono">1. iLoveAPI</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      health.providers.iloveapi ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {health.providers.iloveapi ? (
                    <span className="text-emerald-700 font-semibold">Configured</span>
                  ) : (
                    <span className="text-slate-400">ILOVEPDF_SECRET_KEY unset</span>
                  )}
                </div>
              </div>

              {/* 2. CloudConvert */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 font-mono">2. CloudConvert</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      health.providers.cloudconvert ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {health.providers.cloudconvert ? (
                    <span className="text-emerald-700 font-semibold">Configured</span>
                  ) : (
                    <span className="text-slate-400">CLOUDCONVERT_API_KEY unset</span>
                  )}
                </div>
              </div>

              {/* 3. Adobe PDF Services */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 font-mono">3. Adobe PDF</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      health.providers.adobe ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {health.providers.adobe ? (
                    <span className="text-emerald-700 font-semibold">Configured</span>
                  ) : (
                    <span className="text-slate-400">ADOBE_CLIENT_* unset</span>
                  )}
                </div>
              </div>

              {/* 4. Nutrient */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 font-mono">4. Nutrient</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-medium">Last Resort</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      health.providers.nutrient ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {health.providers.nutrient ? (
                    <span className="text-emerald-700 font-semibold">Configured</span>
                  ) : (
                    <span className="text-slate-400">NUTRIENT_API_KEY unset</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Test Converter Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Test PDF→DOCX Conversion Endpoint</span>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-blue-100 text-blue-800">
                POST /api/yemini/convert-pdf-to-docx
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a PDF (or click "Generate Sample PDF") to test the server fallback chain and inspect the <code className="font-mono text-slate-800">X-Conversion-Provider</code> header.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateSamplePdf}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 border border-slate-300 hover:border-slate-400 rounded transition-colors self-start sm:self-auto cursor-pointer"
          >
            Generate Sample PDF
          </button>
        </div>

        <form onSubmit={handleConvert} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select PDF File (multipart/form-data field: <code className="font-mono text-slate-800">file</code>)
            </label>
            <input
              id="input-yemini-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer cursor-pointer border border-slate-300 rounded p-1"
            />
            {selectedFile && (
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <button
            id="btn-convert-pdf"
            type="submit"
            disabled={!selectedFile || isConverting}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
          >
            {isConverting ? 'Processing Conversion Chain...' : 'Convert PDF to DOCX via Cloud Chain'}
          </button>
        </form>

        {/* Success Output */}
        {successfulProvider && downloadUrl && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Conversion Succeeded!
              </span>
              <span className="text-[11px] font-mono text-emerald-800">
                Time: {conversionDuration ? `${(conversionDuration / 1000).toFixed(2)}s` : ''}
              </span>
            </div>
            <div className="text-xs text-emerald-800">
              Winning Provider (<code className="font-mono font-bold">X-Conversion-Provider</code>):{' '}
              <strong className="font-mono uppercase bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900">
                {successfulProvider}
              </strong>
            </div>
            <div className="pt-2">
              <a
                id="btn-download-docx"
                href={downloadUrl}
                download={downloadFilename}
                className="inline-block px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                Download Converted DOCX ({downloadFilename})
              </a>
            </div>
          </div>
        )}

        {/* 502 / Error Output */}
        {conversionError && (
          <div className="p-4 bg-slate-950 text-slate-200 rounded-lg space-y-2 border border-slate-800 font-mono text-xs">
            <div className="text-rose-400 font-bold flex items-center justify-between">
              <span>HTTP 502 / Conversion Failure:</span>
              <span className="text-[11px] text-slate-400 font-normal">Calling app triggers local fallback</span>
            </div>
            <p className="text-slate-300">{conversionError.error}</p>
            {conversionError.details && (
              <div className="mt-2 space-y-1 text-[11px] border-t border-slate-800 pt-2">
                <div className="text-slate-400 font-semibold">Provider Failure Details:</div>
                {conversionError.details.map((item: any, idx: number) => (
                  <div key={idx} className="text-slate-300 pl-2">
                    • <strong className="text-slate-100">{item.provider}:</strong> {item.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
