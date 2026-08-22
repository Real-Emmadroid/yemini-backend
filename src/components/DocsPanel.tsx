import React, { useState } from 'react';

export const DocsPanel: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sqlSchema = `CREATE TABLE IF NOT EXISTS device_registrations (
    id SERIAL PRIMARY KEY,
    device_id UUID NOT NULL UNIQUE,
    fcm_token TEXT NOT NULL,
    user_id INTEGER NULL,
    platform TEXT DEFAULT 'android',
    app_version TEXT,
    installed_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now()
);`;

  const envContent = `# Neon Database Connection String
DATABASE_URL="postgresql://username:password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

# GitHub OAuth Credentials
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"

# Server Port (Render injects process.env.PORT automatically)
PORT="3000"`;

  return (
    <div
      id="panel-documentation"
      className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6"
    >
      <div>
        <h2 className="text-base font-semibold text-slate-800 tracking-tight">
          API Reference & Deployment Guide
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Complete documentation of all routes, Postgres schema, and production environment setup.
        </p>
      </div>

      {/* SQL Schema Section */}
      <div className="border border-slate-100 rounded p-4 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 font-mono">
            Neon PostgreSQL Schema (Auto-Created on Startup)
          </span>
          <button
            onClick={() => copyToClipboard(sqlSchema, 'schema')}
            className="text-[11px] font-mono text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {copiedSection === 'schema' ? 'Copied!' : 'Copy SQL'}
          </button>
        </div>
        <pre className="text-xs font-mono bg-slate-950 text-slate-200 p-3 rounded overflow-x-auto leading-relaxed border border-slate-800">
          {sqlSchema}
        </pre>
      </div>

      {/* Route List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Endpoint Specifications
        </h3>

        <div className="p-3 border border-slate-200 rounded text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
              GET
            </span>
            <code className="font-mono font-bold text-slate-900">/health</code>
            <span className="text-slate-500">(also /api/health)</span>
          </div>
          <p className="text-slate-600">
            Returns HTTP 200 OK with <code className="font-mono text-slate-800">&#123; status: "ok" &#125;</code> and system diagnostics. Suitable for Render / container health checks.
          </p>
        </div>

        <div className="p-3 border border-slate-200 rounded text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/devices/register</code>
          </div>
          <p className="text-slate-600">
            Upserts by <code className="font-mono text-slate-800">device_id</code>: inserts if new record, or updates <code className="font-mono text-slate-800">fcm_token</code> and <code className="font-mono text-slate-800">last_seen_at</code> if already exists.
          </p>
          <div className="bg-slate-100 p-2 rounded font-mono text-[11px] text-slate-800">
            Body: &#123; device_id: string (UUID), fcm_token: string, platform?: string, app_version?: string &#125;
          </div>
        </div>

        <div className="p-3 border border-slate-200 rounded text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/devices/link-user</code>
          </div>
          <p className="text-slate-600">
            Updates matching row's <code className="font-mono text-slate-800">user_id</code> and sets <code className="font-mono text-slate-800">last_seen_at = now()</code>. Returns 404 if device_id is not found.
          </p>
          <div className="bg-slate-100 p-2 rounded font-mono text-[11px] text-slate-800">
            Body: &#123; device_id: string (UUID), user_id: number | null &#125;
          </div>
        </div>

        <div className="p-3 border border-slate-200 rounded text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/github/exchange-token</code>
          </div>
          <p className="text-slate-600">
            Calls GitHub's <code className="font-mono text-slate-800">https://github.com/login/oauth/access_token</code> using <code className="font-mono text-slate-800">GITHUB_CLIENT_ID</code> and <code className="font-mono text-slate-800">GITHUB_CLIENT_SECRET</code>. Returns <code className="font-mono text-slate-800">&#123; access_token, token_type, scope &#125;</code> on success or a clean <code className="font-mono text-slate-800">&#123; error &#125;</code> on failure. Client secret is never exposed.
          </p>
          <div className="bg-slate-100 p-2 rounded font-mono text-[11px] text-slate-800">
            Body: &#123; code: string &#125;
          </div>
        </div>
      </div>

      {/* Render / Production deployment */}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Deploying to Render or Cloud Run
        </h3>
        <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
          <li>
            <strong>Build Command:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">npm run build</code>
          </li>
          <li>
            <strong>Start Command:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">npm start</code>
          </li>
          <li>
            <strong>Health Check Path:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">/health</code>
          </li>
          <li>
            <strong>Environment Variables:</strong> Add <code className="font-mono text-slate-800">DATABASE_URL</code>, <code className="font-mono text-slate-800">GITHUB_CLIENT_ID</code>, and <code className="font-mono text-slate-800">GITHUB_CLIENT_SECRET</code> in the Render Dashboard under Environment.
          </li>
        </ul>
      </div>
    </div>
  );
};
