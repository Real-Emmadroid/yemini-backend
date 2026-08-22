import React from 'react';
import { DeviceRegistration } from '../types';

interface DatabaseTablePanelProps {
  devices: DeviceRegistration[];
  loading: boolean;
  onRefresh: () => void;
  onSelectDeviceId?: (deviceId: string) => void;
}

export const DatabaseTablePanel: React.FC<DatabaseTablePanelProps> = ({
  devices,
  loading,
  onRefresh,
  onSelectDeviceId,
}) => {
  return (
    <div
      id="panel-database-records"
      className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-800">
              TABLE
            </span>
            <span className="font-mono text-sm font-semibold text-slate-800">
              device_registrations
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {devices.length} record{devices.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Live query from Neon PostgreSQL database table.
          </p>
        </div>

        <button
          id="btn-refresh-devices"
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto font-mono"
        >
          {loading ? 'Fetching...' : 'Refresh Records'}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-mono">
              <th className="py-2.5 px-3 font-semibold">ID</th>
              <th className="py-2.5 px-3 font-semibold">device_id (UUID)</th>
              <th className="py-2.5 px-3 font-semibold">user_id</th>
              <th className="py-2.5 px-3 font-semibold">platform</th>
              <th className="py-2.5 px-3 font-semibold">app_version</th>
              <th className="py-2.5 px-3 font-semibold">fcm_token</th>
              <th className="py-2.5 px-3 font-semibold">last_seen_at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {devices.length > 0 ? (
              devices.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 text-slate-500 font-medium">{row.id}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 font-semibold">{row.device_id}</span>
                      {onSelectDeviceId && (
                        <button
                          type="button"
                          onClick={() => onSelectDeviceId(row.device_id)}
                          title="Copy to form fields"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                        >
                          use
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    {row.user_id !== null ? (
                      <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-100">
                        {row.user_id}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">null</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                      {row.platform || 'android'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {row.app_version || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 max-w-[140px] truncate" title={row.fcm_token}>
                    {row.fcm_token}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    {row.last_seen_at ? new Date(row.last_seen_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                  {loading
                    ? 'Loading records from Neon Postgres...'
                    : 'No device registrations found in database yet. Use the registration form above to create the first record.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
