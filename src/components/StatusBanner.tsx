import React from 'react';
import { HealthResponse } from '../types';

interface StatusBannerProps {
  health: HealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  health,
  loading,
  onRefresh,
}) => {
  const isHealthy = health?.status === 'ok';
  const isDbConnected = Boolean(health?.database?.connected);
  const isGithubConfigured = Boolean(health?.env?.github_configured);

  return (
    <div
      id="status-overview-panel"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 text-slate-100 mb-6 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Backend Service Console
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">
              Port {health?.env?.port || 3000}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Neon Postgres Device Registry & GitHub OAuth Token Exchange Service
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-refresh-health"
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Checking...' : 'Refresh Health'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/80">
        <div
          id="stat-api-status"
          className="bg-slate-950/60 p-3 rounded border border-slate-800"
        >
          <span className="text-xs text-slate-400 font-mono block">
            HTTP API Server
          </span>
          <span className="text-sm font-medium text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            200 OK — Ready
          </span>
        </div>

        <div
          id="stat-db-status"
          className="bg-slate-950/60 p-3 rounded border border-slate-800"
        >
          <span className="text-xs text-slate-400 font-mono block">
            Neon PostgreSQL
          </span>
          {isDbConnected ? (
            <span className="text-sm font-medium text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Connected & Schema Ready
            </span>
          ) : (
            <span className="text-sm font-medium text-amber-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {health?.database?.configured
                ? 'Connecting...'
                : 'DATABASE_URL Pending'}
            </span>
          )}
        </div>

        <div
          id="stat-github-status"
          className="bg-slate-950/60 p-3 rounded border border-slate-800"
        >
          <span className="text-xs text-slate-400 font-mono block">
            GitHub OAuth App
          </span>
          {isGithubConfigured ? (
            <span className="text-sm font-medium text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Credentials Configured
            </span>
          ) : (
            <span className="text-sm font-medium text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              Awaiting CLIENT_ID/SECRET
            </span>
          )}
        </div>
      </div>

      {!isDbConnected && (
        <div className="mt-3 p-2.5 rounded bg-amber-950/40 border border-amber-900/60 text-xs text-amber-300">
          <span className="font-semibold">Notice:</span> Database is currently
          unconnected. When running on Render or locally, supply{' '}
          <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200">
            DATABASE_URL
          </code>{' '}
          in your environment variables to connect to your Neon instance.
        </div>
      )}
    </div>
  );
};
