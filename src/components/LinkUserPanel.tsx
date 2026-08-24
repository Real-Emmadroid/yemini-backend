import React, { useState, useEffect } from 'react';
import { ApiResponse, User } from '../types';

interface LinkUserPanelProps {
  authToken: string;
  currentUser: User | null;
  onSuccess: () => void;
}

export const LinkUserPanel: React.FC<LinkUserPanelProps> = ({
  authToken,
  currentUser,
  onSuccess,
}) => {
  const [deviceId, setDeviceId] = useState(
    '8f3b21c4-729d-4e92-9388-c4491763a890'
  );
  const [tokenInput, setTokenInput] = useState(authToken);

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'kotlin' | 'fetch'>('curl');

  useEffect(() => {
    setTokenInput(authToken);
  }, [authToken]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setHttpStatus(null);
    const start = performance.now();

    try {
      const res = await fetch('/api/devices/link-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenInput}`,
        },
        body: JSON.stringify({
          device_id: deviceId.trim(),
        }),
      });

      const data = await res.json();
      setHttpStatus(res.status);
      setLatency(Math.round(performance.now() - start));
      setResponse(data);
      if (res.ok) {
        onSuccess();
      }
    } catch (err: any) {
      setHttpStatus(500);
      setLatency(Math.round(performance.now() - start));
      setResponse({ error: err.message || 'Network request failed' });
    } finally {
      setLoading(false);
    }
  };

  const curlSnippet = `curl -X POST "${window.location.origin}/api/devices/link-user" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenInput || 'YOUR_JWT_TOKEN'}" \\
  -d '{
    "device_id": "${deviceId}"
  }'`;

  const kotlinSnippet = `// Android Kotlin / Retrofit
val payload = LinkUserRequest(
    deviceId = "${deviceId}"
)
// Interceptor automatically attaches Header "Authorization: Bearer \${token}"
apiService.linkUser(token = "Bearer $tokenInput", payload)`;

  const fetchSnippet = `await fetch('/api/devices/link-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${tokenInput || 'YOUR_JWT_TOKEN'}'
  },
  body: JSON.stringify({
    device_id: '${deviceId}'
  })
});`;

  return (
    <div
      id="panel-device-link-user"
      className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-100 text-purple-800">
              POST
            </span>
            <span className="font-mono text-sm font-semibold text-slate-800">
              /api/devices/link-user
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200">
              JWT Protected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Updates matching device row with authenticated <code className="font-mono text-slate-700">req.userId</code> and refreshes <code className="font-mono text-slate-700">last_seen_at</code>.
          </p>
        </div>

        {currentUser && (
          <div className="text-xs px-3 py-1.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Authenticated User: <strong>ID #{currentUser.id}</strong> ({currentUser.email})</span>
          </div>
        )}
      </div>

      {/* Token Header Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 my-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="input-link-jwt" className="text-xs font-semibold text-slate-700 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Authorization: Bearer &lt;token&gt;
          </label>
          <span className="text-[11px] text-slate-500">
            {tokenInput ? 'JWT attached' : 'No token (will return 401 Unauthorized)'}
          </span>
        </div>
        <input
          id="input-link-jwt"
          type="text"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Paste or enter signed JWT token"
          className="w-full text-xs font-mono px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 bg-white"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
        {/* Form Column */}
        <form onSubmit={handleLink} className="lg:col-span-6 space-y-4">
          <div>
            <label
              htmlFor="input-link-device-id"
              className="text-xs font-semibold text-slate-700 font-mono block mb-1"
            >
              device_id (UUID) <span className="text-red-500">*</span>
            </label>
            <input
              id="input-link-device-id"
              type="text"
              required
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. 8f3b21c4-729d-4e92-9388-c4491763a890"
              className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 bg-slate-50 text-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              The device ID registered via <code>/api/devices/register</code>. The user ID will be extracted safely from your JWT token.
            </p>
          </div>

          <div className="pt-2">
            <button
              id="btn-submit-link-user"
              type="submit"
              disabled={loading || !tokenInput}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Linking Device to req.userId...
                </>
              ) : (
                'Link Device to Authenticated User (POST)'
              )}
            </button>
          </div>

          {/* Code Snippets */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Client Snippet:
              </span>
              {(['curl', 'kotlin', 'fetch'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveCodeTab(tab)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded cursor-pointer ${
                    activeCodeTab === tab
                      ? 'bg-slate-200 text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <pre className="text-[11px] font-mono bg-slate-950 text-slate-300 p-3 rounded overflow-x-auto leading-relaxed border border-slate-800">
              {activeCodeTab === 'curl' && curlSnippet}
              {activeCodeTab === 'kotlin' && kotlinSnippet}
              {activeCodeTab === 'fetch' && fetchSnippet}
            </pre>
          </div>
        </form>

        {/* Response Column */}
        <div className="lg:col-span-6 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 font-mono">
              Server Response
            </span>
            {httpStatus && (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded font-medium ${
                    httpStatus >= 200 && httpStatus < 300
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  HTTP {httpStatus}
                </span>
                {latency !== null && (
                  <span className="text-xs text-slate-400 font-mono">
                    {latency}ms
                  </span>
                )}
              </div>
            )}
          </div>

          <div
            id="response-link-user-box"
            className="flex-1 min-h-[220px] bg-slate-950 text-slate-200 rounded p-4 font-mono text-xs overflow-auto border border-slate-800"
          >
            {response ? (
              <pre className="whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(response, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-center py-10">
                Click "Link Device to Authenticated User" to link this device ID to the authenticated user ID.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
