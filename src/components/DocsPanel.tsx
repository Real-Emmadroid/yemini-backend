import React, { useState } from 'react';

export const DocsPanel: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sqlSchema = `-- 1. Users Table (Bcrypt Hashed Passwords)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NULL,
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
);`;

  const envContent = `# Neon Database Connection String
DATABASE_URL="postgresql://username:password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

# JWT Signing Secret (generate a long random string for production on Render)
JWT_SECRET="generate-a-secure-random-64-character-jwt-signing-secret"

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
          REST API Reference & Security Guide
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Complete documentation of Bcrypt authentication, JWT security middleware, PostgreSQL schemas, and Render configuration.
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
          Authentication & API Endpoints
        </h3>

        {/* POST /api/auth/register */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/auth/register</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium">Public</span>
          </div>
          <p className="text-slate-600">
            Expects plaintext password in request body. Hashes password with <code className="font-mono text-slate-800">bcrypt.hash(password, 12)</code> before storing in <code className="font-mono text-slate-800">password_hash</code>. Generates and returns a signed 30-day JWT. Never logs the plaintext password.
          </p>
          <div className="bg-slate-100 p-2 rounded font-mono text-[11px] text-slate-800">
            Body: &#123; "email": string, "password": string (plaintext), "name"?: string &#125;<br />
            Returns: &#123; "success": true, "user": &#123; "id": 1, "email": "...", "name": "..." &#125;, "token": "eyJhbGci..." &#125;
          </div>
        </div>

        {/* POST /api/auth/login */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/auth/login</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium">Public</span>
          </div>
          <p className="text-slate-600">
            Expects plaintext password. Looks up user by email and compares via <code className="font-mono text-slate-800">bcrypt.compare(password, storedHash)</code> (constant-time verification). Returns signed JWT with 30-day expiry.
          </p>
          <div className="bg-slate-100 p-2 rounded font-mono text-[11px] text-slate-800">
            Body: &#123; "email": string, "password": string &#125;<br />
            Returns: &#123; "success": true, "user": &#123; ... &#125;, "token": "eyJhbGci..." &#125;
          </div>
        </div>

        {/* POST /api/projects/save */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-amber-50/30">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/projects/save</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-medium">JWT Required</span>
          </div>
          <p className="text-slate-600">
            Upserts user project using verified <code className="font-mono text-slate-800">req.userId</code> from JWT.
          </p>
          <div className="bg-slate-100 p-2 rounded font-mono text-[11px] text-slate-800">
            Headers: Authorization: Bearer &lt;token&gt;<br />
            Body: &#123; "project_id": string, "name": string, "data"?: any &#125;
          </div>
        </div>

        {/* GET /api/projects/user/:userId */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-amber-50/30">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
              GET
            </span>
            <code className="font-mono font-bold text-slate-900">/api/projects/user/:userId</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-medium">JWT Required</span>
          </div>
          <p className="text-slate-600">
            Returns all projects owned by the authenticated user. Uses <code className="font-mono text-slate-800">req.userId</code> from token, returning 403 Forbidden if a user attempts to query another user's projects.
          </p>
          <div className="bg-slate-100 p-2 rounded font-mono text-[11px] text-slate-800">
            Headers: Authorization: Bearer &lt;token&gt;
          </div>
        </div>

        {/* DELETE /api/projects/:userId/:projectId */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-amber-50/30">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800">
              DELETE
            </span>
            <code className="font-mono font-bold text-slate-900">/api/projects/:userId/:projectId</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-medium">JWT Required</span>
          </div>
          <p className="text-slate-600">
            Deletes the specified project belonging to <code className="font-mono text-slate-800">req.userId</code>.
          </p>
        </div>

        {/* POST /api/devices/link-user */}
        <div className="p-3.5 border border-slate-200 rounded text-xs space-y-1.5 bg-amber-50/30">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/devices/link-user</code>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-medium">JWT Required</span>
          </div>
          <p className="text-slate-600">
            Updates matching device row with authenticated <code className="font-mono text-slate-800">req.userId</code> and sets <code className="font-mono text-slate-800">last_seen_at = now()</code>.
          </p>
          <div className="bg-slate-100 p-2 rounded font-mono text-[11px] text-slate-800">
            Headers: Authorization: Bearer &lt;token&gt;<br />
            Body: &#123; "device_id": string (UUID) &#125;
          </div>
        </div>

        {/* Public Utility Endpoints */}
        <div className="p-3 border border-slate-200 rounded text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
              GET
            </span>
            <code className="font-mono font-bold text-slate-900">/health</code>
            <span className="text-slate-500">(also /api/health)</span>
          </div>
          <p className="text-slate-600">
            Returns HTTP 200 OK with database connection status and environment configuration.
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
        </div>

        <div className="p-3 border border-slate-200 rounded text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900">
              POST
            </span>
            <code className="font-mono font-bold text-slate-900">/api/github/exchange-token</code>
          </div>
          <p className="text-slate-600">
            Exchanges GitHub OAuth temporary code for an access token on the server side without exposing <code className="font-mono text-slate-800">GITHUB_CLIENT_SECRET</code>.
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
