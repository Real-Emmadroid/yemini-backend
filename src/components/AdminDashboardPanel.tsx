import React, { useState, useEffect, useCallback } from 'react';
import { User, AdminDashboardData, LanguageEventPayload, ExtensionInstallPayload } from '../types';

interface AdminDashboardPanelProps {
  authToken: string;
  currentUser: User | null;
}

export const AdminDashboardPanel: React.FC<AdminDashboardPanelProps> = ({
  authToken,
  currentUser,
}) => {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Language Event Form State
  const [langDeviceId, setLangDeviceId] = useState<string>('8f3b21c4-729d-4e92-9388-c4491763a890');
  const [langName, setLangName] = useState<string>('typescript');
  const [langAction, setLangAction] = useState<string>('open');
  const [langLoading, setLangLoading] = useState<boolean>(false);
  const [langResult, setLangResult] = useState<any>(null);

  // Extension Install Form State
  const [extDeviceId, setExtDeviceId] = useState<string>('8f3b21c4-729d-4e92-9388-c4491763a890');
  const [extId, setExtId] = useState<string>('esbenp.prettier-vscode');
  const [extName, setExtName] = useState<string>('Prettier - Code formatter');
  const [extLoading, setExtLoading] = useState<boolean>(false);
  const [extResult, setExtResult] = useState<any>(null);

  // Mark GitHub Connected State
  const [markGithubLoading, setMarkGithubLoading] = useState<boolean>(false);
  const [markGithubResult, setMarkGithubResult] = useState<any>(null);

  const fetchDashboard = useCallback(async () => {
    if (!authToken) {
      setDashboardError('Please log in with an admin account (matching ADMIN_EMAILS) to view dashboard data.');
      return;
    }

    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        setDashboardError(data.error || `HTTP ${res.status}: Failed to fetch dashboard`);
        setDashboardData(null);
      } else {
        setDashboardData(data);
      }
    } catch (err: any) {
      setDashboardError(err.message || 'Network error fetching dashboard');
      setDashboardData(null);
    } finally {
      setLoadingDashboard(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchDashboard();
    }
  }, [authToken, fetchDashboard]);

  const handleSendLanguageEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLangLoading(true);
    setLangResult(null);

    try {
      const payload: LanguageEventPayload = {
        device_id: langDeviceId.trim(),
        language: langName.trim(),
        action: langAction.trim(),
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/analytics/language-event', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setLangResult(data);
      if (authToken) {
        fetchDashboard();
      }
    } catch (err: any) {
      setLangResult({ error: err.message });
    } finally {
      setLangLoading(false);
    }
  };

  const handleSendExtensionInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtLoading(true);
    setExtResult(null);

    try {
      const payload: ExtensionInstallPayload = {
        device_id: extDeviceId.trim(),
        extension_id: extId.trim(),
        extension_name: extName.trim() || undefined,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/analytics/extension-install', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setExtResult(data);
      if (authToken) {
        fetchDashboard();
      }
    } catch (err: any) {
      setExtResult({ error: err.message });
    } finally {
      setExtLoading(false);
    }
  };

  const handleMarkGithubConnected = async () => {
    if (!authToken) return;
    setMarkGithubLoading(true);
    setMarkGithubResult(null);

    try {
      const res = await fetch('/api/github/mark-connected', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      setMarkGithubResult(data);
      fetchDashboard();
    } catch (err: any) {
      setMarkGithubResult({ error: err.message });
    } finally {
      setMarkGithubLoading(false);
    }
  };

  return (
    <div id="panel-admin-dashboard" className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Admin Dashboard & Telemetry</span>
              <span className="text-[11px] px-2 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-700">
                GET /api/admin/dashboard
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Protected by JWT authentication and verified against <code className="font-mono text-slate-800">ADMIN_EMAILS</code> environment variable.
            </p>
          </div>

          <button
            id="btn-refresh-admin-dashboard"
            onClick={fetchDashboard}
            disabled={loadingDashboard || !authToken}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors self-start sm:self-auto flex items-center gap-1.5"
          >
            {loadingDashboard ? 'Loading...' : 'Refresh Metrics'}
          </button>
        </div>

        {/* Auth Notice */}
        {!authToken ? (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
            <span className="font-semibold">Authentication Required:</span> Log in with an account on the <strong>Auth & JWT</strong> tab whose email is listed in <code className="font-mono">ADMIN_EMAILS</code>.
          </div>
        ) : dashboardError ? (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
            <div className="font-semibold">Access Denied / Error:</div>
            <div className="mt-0.5">{dashboardError}</div>
            {currentUser && (
              <div className="mt-2 text-[11px] text-rose-700 font-mono">
                Current account: {currentUser.email} | Add this email to ADMIN_EMAILS in .env to grant access.
              </div>
            )}
          </div>
        ) : dashboardData ? (
          <div className="mt-6 space-y-6">
            {/* Storage indicator */}
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono border-b border-slate-100 pb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active Storage: <strong className="text-slate-800">{dashboardData.storage}</strong>
              </span>
              <span>Generated: {new Date(dashboardData.generated_at).toLocaleTimeString()}</span>
            </div>

            {/* Metric Totals Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500 font-medium">Total Users</div>
                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{dashboardData.totals.total_users}</div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500 font-medium">Signed In Users</div>
                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{dashboardData.totals.cloud_signed_in_users}</div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500 font-medium">Total Installs</div>
                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{dashboardData.totals.total_installs}</div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500 font-medium">GitHub Connected</div>
                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{dashboardData.totals.github_connected_users}</div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500 font-medium">Active Now (5m)</div>
                <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">{dashboardData.totals.active_now}</div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500 font-medium">Active 24h</div>
                <div className="text-xl font-bold text-blue-700 mt-1 font-mono">{dashboardData.totals.active_24h}</div>
              </div>
            </div>

            {/* Top Languages & Extensions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Languages */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Top Languages ({dashboardData.top_languages.length})
                </h3>
                {dashboardData.top_languages.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No language events logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {dashboardData.top_languages.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 font-mono">
                        <span className="font-semibold text-slate-800">{item.language}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-bold">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Extensions */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Top Extensions ({dashboardData.top_extensions.length})
                </h3>
                {dashboardData.top_extensions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No extension installs logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {dashboardData.top_extensions.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-slate-50">
                        <div className="truncate mr-2">
                          <div className="font-semibold text-slate-800 font-mono text-[11px] truncate">
                            {item.extension_id}
                          </div>
                          {item.extension_name && (
                            <div className="text-[10px] text-slate-500 truncate">{item.extension_name}</div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-bold font-mono">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Analytics Event Dispatchers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Log Language Event */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Log Language Event</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-100 text-blue-800">
                POST /api/analytics/language-event
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Dispatches a telemetry open/switch event with optional JWT user linking.
            </p>
          </div>

          <form onSubmit={handleSendLanguageEvent} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Device ID (UUID)</label>
              <input
                id="input-lang-device-id"
                type="text"
                value={langDeviceId}
                onChange={(e) => setLangDeviceId(e.target.value)}
                required
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Language</label>
                <input
                  id="input-lang-name"
                  type="text"
                  value={langName}
                  onChange={(e) => setLangName(e.target.value)}
                  placeholder="e.g. rust, python, typescript"
                  required
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Action</label>
                <input
                  id="input-lang-action"
                  type="text"
                  value={langAction}
                  onChange={(e) => setLangAction(e.target.value)}
                  placeholder="open (default)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <button
              id="btn-submit-language-event"
              type="submit"
              disabled={langLoading}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              {langLoading ? 'Logging Event...' : 'Send Language Event'}
            </button>
          </form>

          {langResult && (
            <div className="p-2.5 bg-slate-950 text-slate-200 rounded font-mono text-[11px] overflow-x-auto">
              <pre>{JSON.stringify(langResult, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* 2. Log Extension Install */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Log Extension Install</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-100 text-blue-800">
                POST /api/analytics/extension-install
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks marketplace extension installations by device and optional user ID.
            </p>
          </div>

          <form onSubmit={handleSendExtensionInstall} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Device ID (UUID)</label>
              <input
                id="input-ext-device-id"
                type="text"
                value={extDeviceId}
                onChange={(e) => setExtDeviceId(e.target.value)}
                required
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Extension ID</label>
                <input
                  id="input-ext-id"
                  type="text"
                  value={extId}
                  onChange={(e) => setExtId(e.target.value)}
                  placeholder="e.g. rust-lang.rust-analyzer"
                  required
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Extension Name (Optional)</label>
                <input
                  id="input-ext-name"
                  type="text"
                  value={extName}
                  onChange={(e) => setExtName(e.target.value)}
                  placeholder="e.g. Rust Analyzer"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <button
              id="btn-submit-extension-event"
              type="submit"
              disabled={extLoading}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              {extLoading ? 'Logging Install...' : 'Send Extension Install Event'}
            </button>
          </form>

          {extResult && (
            <div className="p-2.5 bg-slate-950 text-slate-200 rounded font-mono text-[11px] overflow-x-auto">
              <pre>{JSON.stringify(extResult, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* GitHub Connected Toggle */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Mark GitHub Account Connected</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-100 text-purple-800">
                POST /api/github/mark-connected
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sets <code className="font-mono text-slate-800">github_connected = TRUE</code> and <code className="font-mono text-slate-800">github_connected_at = NOW()</code> on the authenticated user record.
            </p>
          </div>

          <button
            id="btn-mark-github-connected"
            onClick={handleMarkGithubConnected}
            disabled={markGithubLoading || !authToken}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            {markGithubLoading ? 'Updating...' : 'Mark Current User as GitHub Connected'}
          </button>
        </div>

        {markGithubResult && (
          <div className="p-2.5 bg-slate-950 text-slate-200 rounded font-mono text-[11px] overflow-x-auto">
            <pre>{JSON.stringify(markGithubResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
