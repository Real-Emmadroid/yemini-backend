import React, { useState } from 'react';
import { ApiResponse } from '../types';

export const GithubExchangePanel: React.FC = () => {
  const [code, setCode] = useState('7812bc89fa0145ef0123');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'kotlin' | 'fetch'>('curl');

  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setHttpStatus(null);
    const start = performance.now();

    try {
      const res = await fetch('/api/github/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
        }),
      });

      const data = await res.json();
      setHttpStatus(res.status);
      setLatency(Math.round(performance.now() - start));
      setResponse(data);
    } catch (err: any) {
      setHttpStatus(500);
      setLatency(Math.round(performance.now() - start));
      setResponse({ error: err.message || 'Network request failed' });
    } finally {
      setLoading(false);
    }
  };

  const curlSnippet = `curl -X POST "${window.location.origin}/api/github/exchange-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "${code}"
  }'`;

  const kotlinSnippet = `// Android Kotlin / Retrofit
val payload = ExchangeTokenRequest(code = "${code}")
val response = apiService.exchangeGithubToken(payload)
// val accessToken = response.access_token`;

  const fetchSnippet = `const res = await fetch('/api/github/exchange-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: '${code}' })
});
const { access_token } = await res.json();`;

  return (
    <div
      id="panel-github-token-exchange"
      className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-100 text-amber-900">
              POST
            </span>
            <span className="font-mono text-sm font-semibold text-slate-800">
              /api/github/exchange-token
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Exchanges temporary GitHub OAuth code for access token via GitHub API. Client secret is kept strictly server-side.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
        {/* Form Column */}
        <form onSubmit={handleExchange} className="lg:col-span-6 space-y-4">
          <div>
            <label
              htmlFor="input-github-code"
              className="text-xs font-semibold text-slate-700 font-mono block mb-1"
            >
              code (OAuth authorization code) <span className="text-red-500">*</span>
            </label>
            <input
              id="input-github-code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 7812bc89fa0145ef0123"
              className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50 text-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Received by the client app after GitHub login redirect (<code className="font-mono">?code=xyz</code>).
            </p>
          </div>

          <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Security Architecture:</div>
            <div>
              1. Mobile / Web client gets temporary code from GitHub OAuth redirect.
            </div>
            <div>
              2. Client sends code to <code className="font-mono text-slate-800">/api/github/exchange-token</code>.
            </div>
            <div>
              3. Server injects private <code className="font-mono text-slate-800">GITHUB_CLIENT_SECRET</code> to call GitHub.
            </div>
            <div>
              4. Server returns <code className="font-mono text-slate-800">&#123; access_token &#125;</code> without leaking credentials.
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-submit-github-exchange"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium tracking-wide transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Exchanging Code with GitHub...' : 'Send POST /api/github/exchange-token'}
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
            id="response-github-exchange-box"
            className="flex-1 min-h-[220px] bg-slate-950 text-slate-200 rounded p-4 font-mono text-xs overflow-auto border border-slate-800"
          >
            {response ? (
              <pre className="whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(response, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-center py-10">
                Click "Send POST /api/github/exchange-token" to test the code exchange endpoint.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
