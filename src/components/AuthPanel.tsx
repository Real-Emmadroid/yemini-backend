import React, { useState } from 'react';
import { User, ApiResponse } from '../types';

interface AuthPanelProps {
  authToken: string;
  currentUser: User | null;
  onAuthSuccess: (token: string, user: User) => void;
  onLogout: () => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({
  authToken,
  currentUser,
  onAuthSuccess,
  onLogout,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('developer@example.com');
  const [password, setPassword] = useState('SecurePass123!');
  const [name, setName] = useState('Alex River');

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setHttpStatus(null);
    const start = performance.now();

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload =
      mode === 'register'
        ? { email: email.trim(), password, name: name.trim() }
        : { email: email.trim(), password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setHttpStatus(res.status);
      setLatency(Math.round(performance.now() - start));
      setResponse(data);

      if (res.ok && data.token && data.user) {
        onAuthSuccess(data.token, data.user);
      }
    } catch (err: any) {
      setHttpStatus(500);
      setLatency(Math.round(performance.now() - start));
      setResponse({ error: err.message || 'Network request failed' });
    } finally {
      setLoading(false);
    }
  };

  const curlRegister = `curl -X POST "${window.location.origin}/api/auth/register" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "${email}",
    "password": "${password}",
    "name": "${name}"
  }'`;

  const curlLogin = `curl -X POST "${window.location.origin}/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "${email}",
    "password": "${password}"
  }'`;

  return (
    <div
      id="panel-auth-jwt"
      className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-100 text-blue-800">
              POST
            </span>
            <span className="text-xs font-mono text-slate-500">
              {mode === 'register' ? '/api/auth/register' : '/api/auth/login'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
              Public Route
            </span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mt-1">
            Server-Side Password Hashing & JWT Authentication
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Passwords hashed with <code className="text-slate-800 font-mono font-semibold">bcrypt (12 rounds)</code>, tokens signed with <code className="text-slate-800 font-mono font-semibold">JWT_SECRET</code> (30-day expiry).
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-md border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            id="tab-auth-register"
            onClick={() => {
              setMode('register');
              setResponse(null);
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register User
          </button>
          <button
            type="button"
            id="tab-auth-login"
            onClick={() => {
              setMode('login');
              setResponse(null);
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Log In
          </button>
        </div>
      </div>

      {/* Active Session Status */}
      {currentUser && authToken && (
        <div
          id="auth-session-card"
          className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-900">
                  {currentUser.name || 'User'}
                </span>
                <span className="text-xs font-mono px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                  ID #{currentUser.id}
                </span>
                <span className="text-xs text-emerald-700">({currentUser.email})</span>
              </div>
              <p className="text-xs font-mono text-emerald-700/80 truncate max-w-md mt-0.5">
                Token: {authToken.slice(0, 24)}...{authToken.slice(-12)}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-logout"
            onClick={onLogout}
            className="px-3 py-1.5 rounded text-xs font-medium bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 transition-colors self-start sm:self-auto cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Form and cURL Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Full Name (Optional)
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex River"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Plaintext Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {mode === 'register'
                ? 'Server hashes with bcrypt.hash(password, 12) before inserting into PostgreSQL.'
                : 'Server looks up user and verifies using bcrypt.compare(password, storedHash).'}
            </p>
          </div>

          <button
            type="submit"
            id="btn-submit-auth"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {mode === 'register' ? 'Hashing & Registering...' : 'Verifying Credentials...'}
              </>
            ) : mode === 'register' ? (
              'Create Account & Get JWT (POST)'
            ) : (
              'Sign In & Get JWT (POST)'
            )}
          </button>
        </form>

        {/* cURL Code Preview */}
        <div className="flex flex-col">
          <span className="text-xs font-medium text-slate-700 mb-1">
            cURL Request Template:
          </span>
          <div className="bg-slate-900 text-slate-200 p-3.5 rounded text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 flex-1">
            <pre>{mode === 'register' ? curlRegister : curlLogin}</pre>
          </div>
        </div>
      </div>

      {/* Response Box */}
      {response && (
        <div
          id="auth-response-output"
          className={`p-4 rounded border text-xs font-mono space-y-2 ${
            httpStatus && httpStatus >= 200 && httpStatus < 300
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between font-sans font-semibold">
            <span className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  httpStatus && httpStatus < 300 ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              />
              HTTP Status: {httpStatus}
            </span>
            {latency !== null && (
              <span className="text-[11px] font-mono text-slate-500 font-normal">
                {latency}ms (includes bcrypt work factor)
              </span>
            )}
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap bg-white/70 p-3 rounded border border-slate-200/50">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
