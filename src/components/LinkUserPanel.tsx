import React, { useState } from 'react';
import { ApiResponse } from '../types';

interface LinkUserPanelProps {
  onSuccess: () => void;
}

export const LinkUserPanel: React.FC<LinkUserPanelProps> = ({ onSuccess }) => {
  const [deviceId, setDeviceId] = useState(
    '8f3b21c4-729d-4e92-9388-c4491763a890'
  );
  const [userId, setUserId] = useState('42');

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'kotlin' | 'fetch'>('curl');

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setHttpStatus(null);
    const start = performance.now();

    try {
      const res = await fetch('/api/devices/link-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId.trim(),
          user_id: userId.trim() === '' ? null : parseInt(userId.trim(), 10),
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
  -d '{
    "device_id": "${deviceId}",
    "user_id": ${userId ? userId : 'null'}
  }'`;

  const kotlinSnippet = `// Android Kotlin / Retrofit
val payload = LinkUserRequest(
    deviceId = "${deviceId}",
    userId = ${userId ? userId : 'null'}
)
apiService.linkUser(payload)`;

  const fetchSnippet = `await fetch('/api/devices/link-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_id: '${deviceId}',
    user_id: ${userId ? userId : 'null'}
  })
});`;

  return (
    <div
      id="panel-device-link-user"
      className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-100 text-purple-800">
              POST
            </span>
            <span className="font-mono text-sm font-semibold text-slate-800">
              /api/devices/link-user
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Updates the matching device row's <code className="font-mono text-slate-700">user_id</code> and refreshes <code className="font-mono text-slate-700">last_seen_at</code>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
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
          </div>

          <div>
            <label
              htmlFor="input-link-user-id"
              className="text-xs font-semibold text-slate-700 font-mono block mb-1"
            >
              user_id (Integer or leave blank for null)
            </label>
            <input
              id="input-link-user-id"
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. 42"
              className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 bg-slate-50 text-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Associate this device registration with an authenticated backend user account ID.
            </p>
          </div>

          <div className="pt-2">
            <button
              id="btn-submit-link-user"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium tracking-wide transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Linking User...' : 'Send POST /api/devices/link-user'}
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
                Click "Send POST /api/devices/link-user" to test updating the user_id for a registered device.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
