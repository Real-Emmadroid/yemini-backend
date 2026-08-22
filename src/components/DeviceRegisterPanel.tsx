import React, { useState } from 'react';
import { ApiResponse } from '../types';

interface DeviceRegisterPanelProps {
  onSuccess: () => void;
}

export const DeviceRegisterPanel: React.FC<DeviceRegisterPanelProps> = ({
  onSuccess,
}) => {
  const [deviceId, setDeviceId] = useState(
    '8f3b21c4-729d-4e92-9388-c4491763a890'
  );
  const [fcmToken, setFcmToken] = useState(
    'fcm_dK99_sample_token_xZa90123891048'
  );
  const [platform, setPlatform] = useState('android');
  const [appVersion, setAppVersion] = useState('1.0.0');

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'kotlin' | 'fetch'>('curl');

  const generateUuid = () => {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    setDeviceId(uuid);
  };

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let token = 'fcm_tok_';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFcmToken(token);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setHttpStatus(null);
    const start = performance.now();

    try {
      const res = await fetch('/api/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId.trim(),
          fcm_token: fcmToken.trim(),
          platform: platform.trim(),
          app_version: appVersion.trim() || undefined,
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

  const curlSnippet = `curl -X POST "${window.location.origin}/api/devices/register" \\
  -H "Content-Type: application/json" \\
  -d '{
    "device_id": "${deviceId}",
    "fcm_token": "${fcmToken}",
    "platform": "${platform}",
    "app_version": "${appVersion}"
  }'`;

  const kotlinSnippet = `// Android Kotlin / Retrofit
val payload = DeviceRegisterRequest(
    deviceId = "${deviceId}",
    fcmToken = "${fcmToken}",
    platform = "${platform}",
    appVersion = "${appVersion}"
)
apiService.registerDevice(payload)`;

  const fetchSnippet = `await fetch('/api/devices/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_id: '${deviceId}',
    fcm_token: '${fcmToken}',
    platform: '${platform}',
    app_version: '${appVersion}'
  })
});`;

  return (
    <div
      id="panel-device-register"
      className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-100 text-blue-800">
              POST
            </span>
            <span className="font-mono text-sm font-semibold text-slate-800">
              /api/devices/register
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Upserts device by UUID: inserts new registration or updates FCM token, app version, and last_seen_at.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
        {/* Form Column */}
        <form onSubmit={handleRegister} className="lg:col-span-6 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="input-device-id"
                className="text-xs font-semibold text-slate-700 font-mono"
              >
                device_id (UUID) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={generateUuid}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-mono cursor-pointer"
              >
                Generate UUID
              </button>
            </div>
            <input
              id="input-device-id"
              type="text"
              required
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. 8f3b21c4-729d-4e92-9388-c4491763a890"
              className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 text-slate-900"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="input-fcm-token"
                className="text-xs font-semibold text-slate-700 font-mono"
              >
                fcm_token <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={generateToken}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-mono cursor-pointer"
              >
                New Sample Token
              </button>
            </div>
            <textarea
              id="input-fcm-token"
              required
              rows={2}
              value={fcmToken}
              onChange={(e) => setFcmToken(e.target.value)}
              placeholder="FCM registration token string"
              className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="select-platform"
                className="text-xs font-semibold text-slate-700 font-mono block mb-1"
              >
                platform
              </label>
              <select
                id="select-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800 font-mono"
              >
                <option value="android">android (default)</option>
                <option value="ios">ios</option>
                <option value="web">web</option>
                <option value="desktop">desktop</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="input-app-version"
                className="text-xs font-semibold text-slate-700 font-mono block mb-1"
              >
                app_version
              </label>
              <input
                id="input-app-version"
                type="text"
                value={appVersion}
                onChange={(e) => setAppVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 text-slate-900"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-submit-register"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium tracking-wide transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Sending Upsert Request...' : 'Send POST /api/devices/register'}
            </button>
          </div>

          {/* Code Snippets Accordion */}
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
            id="response-register-box"
            className="flex-1 min-h-[220px] bg-slate-950 text-slate-200 rounded p-4 font-mono text-xs overflow-auto border border-slate-800"
          >
            {response ? (
              <pre className="whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(response, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-center py-10">
                Click "Send POST /api/devices/register" to test the upsert query and inspect the returned record.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
