import React, { useState } from 'react';

export const DocsPanel: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sqlSchema = `-- 1. Users Table (Bcrypt Hashed Passwords & GitHub Status)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NULL,
    github_connected BOOLEAN NOT NULL DEFAULT FALSE,
    github_connected_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Device Registrations
CREATE TABLE IF NOT EXISTS device_registrations (
    id SERIAL PRIMARY KEY,
    device_id UUID NOT NULL UNIQUE,
    fcm_token TEXT NOT NULL,
    user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    platform TEXT DEFAULT 'android',
    app_version TEXT,
    installed_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now()
);

-- 3. User Projects (req.userId Isolated)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data JSONB NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_user_project UNIQUE (user_id, project_id)
);

-- 4. Analytics: Language Events
CREATE TABLE IF NOT EXISTS language_events (
    id SERIAL PRIMARY KEY,
    device_id UUID NOT NULL,
    user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    language TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_language_events_language ON language_events(language);
CREATE INDEX IF NOT EXISTS idx_language_events_created_at ON language_events(created_at);

-- 5. Analytics: Extension Install Events
CREATE TABLE IF NOT EXISTS extension_install_events (
    id SERIAL PRIMARY KEY,
    device_id UUID NOT NULL,
    user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    extension_id TEXT NOT NULL,
    extension_name TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ext_events_extension_id ON extension_install_events(extension_id);`;

  const envContent = `# Neon Database Connection String
DATABASE_URL="postgresql://username:password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

# JWT Signing Secret (generate a long random string for production on Render)
JWT_SECRET="generate-a-secure-random-64-character-jwt-signing-secret"

# Comma-separated list of admin emails allowed to access GET /api/admin/dashboard
ADMIN_EMAILS="you@example.com,admin@yourdomain.com"

# GitHub OAuth Credentials
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"

# Yemini Converter - 4-Provider PDF to DOCX Fallback Chain & PDF Tools
ILOVEPDF_SECRET_KEY=""
NUTRIENT_API_KEY=""
CLOUDCONVERT_API_KEY=""
ADOBE_CLIENT_ID=""
ADOBE_CLIENT_SECRET=""
APP_SHARED_SECRET="generate-a-secure-random-32-byte-hex-secret-for-app-clients"

# Server Port (Render injects process.env.PORT automatically)
PORT="3000"`;

  return (
    <div
      id="panel-documentation"
      className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6"
    >
      <div>
        <h2 className="text-base font-semibold text-slate-800 tracking-tight">
          REST API Reference & Multi-Service Architecture
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Complete documentation of Bcrypt authentication, JWT middleware, telemetry tracking, admin dashboard aggregation, PostgreSQL schemas, and the isolated Yemini PDF→DOCX converter.
        </p>
      </div>

      {/* SQL Schema Section */}
      <div className="border border-slate-100 rounded p-4 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 font-mono">
            Neon PostgreSQL Schema (Auto-Created on Server Boot)
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
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          API Endpoints & Contracts
        </h3>

        {/* POST /api/yemini/convert-pdf-to-docx */}
        <div className="p-3.5 border border-emerald-300 rounded text-xs space-y-1.5 bg-emerald-50/30">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-600 text-white">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/yemini/convert-pdf-to-docx</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-medium">Yemini Service</span>
          </div>
          <p className="text-slate-600">
            Accepts multipart file upload (<code className="font-mono text-slate-800">file</code>), executes 4-provider fallback chain (<strong>iLoveAPI → CloudConvert → Adobe PDF Services → Nutrient</strong>). Returns raw DOCX bytes on success with <code className="font-mono text-slate-800">X-Conversion-Provider</code> header. Returns 502 Bad Gateway if all fail.
          </p>
          <div className="bg-slate-100 p-2 rounded font-mono text-[11px] text-slate-800">
            Body: multipart/form-data with field 'file'<br />
            Response (200): binary/octet-stream (DOCX) + header 'X-Conversion-Provider: &lt;provider&gt;'<br />
            Response (502): &#123; "error": "All 4 cloud conversion providers failed...", "details": [...] &#125;
          </div>
        </div>

        {/* GET /api/yemini/health */}
        <div className="p-3.5 border border-emerald-200 rounded text-xs space-y-1.5 bg-emerald-50/20">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
              GET
            </span>
            <code className="font-mono font-bold text-slate-900">/api/yemini/health</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium">Diagnostics</span>
          </div>
          <p className="text-slate-600">
            Returns boolean status of which conversion providers have their environment variables configured.
          </p>
        </div>

        {/* GET /api/admin/dashboard */}
        <div className="p-3.5 border border-purple-200 rounded text-xs space-y-1.5 bg-purple-50/20">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">
              GET
            </span>
            <code className="font-mono font-bold text-slate-900">/api/admin/dashboard</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 font-medium">Admin JWT Only</span>
          </div>
          <p className="text-slate-600">
            Returns aggregated installation and user metrics, active users (5m / 24h), top 10 languages, and top 10 extensions. Validates that the authenticated user's email is in <code className="font-mono text-slate-800">ADMIN_EMAILS</code>.
          </p>
        </div>

        {/* POST /api/analytics/language-event */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/analytics/language-event</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-medium">Optional Auth</span>
          </div>
          <p className="text-slate-600">
            Logs language usage events for a device. If a valid JWT Bearer token is provided, links <code className="font-mono text-slate-800">user_id</code> automatically.
          </p>
        </div>

        {/* POST /api/analytics/extension-install */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/analytics/extension-install</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-medium">Optional Auth</span>
          </div>
          <p className="text-slate-600">
            Logs extension install events for telemetry.
          </p>
        </div>

        {/* POST /api/github/mark-connected */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-amber-50/30">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/github/mark-connected</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-medium">JWT Required</span>
          </div>
          <p className="text-slate-600">
            Marks the currently authenticated user as having connected their GitHub account.
          </p>
        </div>

        {/* POST /api/auth/register & login */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/auth/register</code>
            <code className="font-mono font-bold text-slate-900 ml-2">/api/auth/login</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium">Public</span>
          </div>
          <p className="text-slate-600">
            Bcrypt authentication with signed 30-day JWT tokens.
          </p>
        </div>

        {/* POST /api/projects/save & GET /api/projects/user/:userId */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-amber-50/30">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">
              POST / GET
            </span>
            <code className="font-mono font-bold text-slate-900">/api/projects/*</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-medium">JWT Required</span>
          </div>
          <p className="text-slate-600">
            Per-user isolated project data management via <code className="font-mono text-slate-800">req.userId</code>.
          </p>
        </div>

        {/* POST /api/devices/register & link-user */}
        <div className="p-3 border border-slate-200 rounded text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/devices/register</code>
            <code className="font-mono font-bold text-slate-900 ml-2">/api/devices/link-user</code>
          </div>
          <p className="text-slate-600">
            Device registration and JWT user-device linking.
          </p>
        </div>

        {/* GET /api/extensions/icons */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
              GET
            </span>
            <code className="font-mono font-bold text-slate-900">/api/extensions/icons</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium">Public</span>
          </div>
          <p className="text-slate-600">
            Returns all extension icons from <code className="font-mono text-slate-800">extension_icons</code> (extension_id, icon_url, updated_at).
          </p>
        </div>
      </div>

      {/* Render Environment Setup */}
      <div className="border border-slate-100 rounded p-4 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 font-mono">
            Render Web Service Environment Variables (.env)
          </span>
          <button
            onClick={() => copyToClipboard(envContent, 'env')}
            className="text-[11px] font-mono text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {copiedSection === 'env' ? 'Copied!' : 'Copy Config'}
          </button>
        </div>
        <pre className="text-xs font-mono bg-slate-950 text-slate-200 p-3 rounded overflow-x-auto leading-relaxed border border-slate-800">
          {envContent}
        </pre>
      </div>
    </div>
  );
};
