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
  const isJwtConfigured = Boolean(health?.env?.jwt_configured);
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
            Bcrypt Hashing • JWT Auth Middleware • Neon PostgreSQL Device Registry & Projects
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

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
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
          id="stat-jwt-status"
          className="bg-slate-950/60 p-3 rounded border border-slate-800"
        >
          <span className="text-xs text-slate-400 font-mono block">
            JWT Auth Security
          </span>
          <span
            className={`text-sm font-medium flex items-center gap-1.5 mt-0.5 ${
              isJwtConfigured ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isJwtConfigured ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {isJwtConfigured ? 'JWT_SECRET Active' : 'Dev Key Active'}
          </span>
        </div>

        <div
          id="stat-db-status"
          className="bg-slate-950/60 p-3 rounded border border-slate-800"
        >
          <span className="text-xs text-slate-400 font-mono block">
            Neon PostgreSQL
          </span>
          <span
            className={`text-sm font-medium flex items-center gap-1.5 mt-0.5 ${
              isDbConnected ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isDbConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {isDbConnected ? 'Connected & Migrated' : 'Memory Mode Active'}
          </span>
        </div>

        <div
          id="stat-github-status"
          className="bg-slate-950/60 p-3 rounded border border-slate-800"
        >
          <span className="text-xs text-slate-400 font-mono block">
            GitHub OAuth
          </span>
          <span
            className={`text-sm font-medium flex items-center gap-1.5 mt-0.5 ${
              isGithubConfigured ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isGithubConfigured ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            />
            {isGithubConfigured ? 'Credentials Set' : 'Optional'}
          </span>
        </div>
      </div>
    </div>
  );
};
