import React, { useState, useEffect } from 'react';
import { User, Project, ApiResponse } from '../types';

interface ProjectsPanelProps {
  authToken: string;
  currentUser: User | null;
}

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  authToken,
  currentUser,
}) => {
  const [projectId, setProjectId] = useState('proj_mobile_dashboard_01');
  const [projectName, setProjectName] = useState('Mobile Dashboard App');
  const [projectDataJson, setProjectDataJson] = useState(
    JSON.stringify(
      {
        theme: 'dark',
        version: '1.2.0',
        features: ['push_notifications', 'biometrics'],
      },
      null,
      2
    )
  );

  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [customToken, setCustomToken] = useState(authToken);

  useEffect(() => {
    setCustomToken(authToken);
  }, [authToken]);

  const fetchUserProjects = async () => {
    if (!currentUser && !customToken) {
      setResponse({
        error: 'Please sign in or provide a Bearer JWT token to access protected projects.',
      });
      return;
    }

    setFetchLoading(true);
    setResponse(null);
    const start = performance.now();

    const targetUserId = currentUser ? currentUser.id : 1;

    try {
      const res = await fetch(`/api/projects/user/${targetUserId}`, {
        headers: {
          Authorization: `Bearer ${customToken}`,
        },
      });

      const data = await res.json();
      setHttpStatus(res.status);
      setLatency(Math.round(performance.now() - start));
      setResponse(data);

      if (res.ok && data.projects) {
        setProjectsList(data.projects);
      }
    } catch (err: any) {
      setHttpStatus(500);
      setLatency(Math.round(performance.now() - start));
      setResponse({ error: err.message || 'Failed to fetch projects' });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (customToken) {
      fetchUserProjects();
    }
  }, [customToken, currentUser]);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setResponse(null);
    const start = performance.now();

    let parsedData = null;
    try {
      if (projectDataJson.trim() !== '') {
        parsedData = JSON.parse(projectDataJson);
      }
    } catch (parseErr) {
      setSaveLoading(false);
      setResponse({ error: 'Invalid JSON in project data payload' });
      return;
    }

    try {
      const res = await fetch('/api/projects/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customToken}`,
        },
        body: JSON.stringify({
          project_id: projectId.trim(),
          name: projectName.trim(),
          data: parsedData,
        }),
      });

      const data = await res.json();
      setHttpStatus(res.status);
      setLatency(Math.round(performance.now() - start));
      setResponse(data);

      if (res.ok) {
        fetchUserProjects();
      }
    } catch (err: any) {
      setHttpStatus(500);
      setLatency(Math.round(performance.now() - start));
      setResponse({ error: err.message || 'Failed to save project' });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteProject = async (projId: string) => {
    const targetUserId = currentUser ? currentUser.id : 1;
    setDeleteLoading(projId);
    setResponse(null);
    const start = performance.now();

    try {
      const res = await fetch(`/api/projects/${targetUserId}/${projId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${customToken}`,
        },
      });

      const data = await res.json();
      setHttpStatus(res.status);
      setLatency(Math.round(performance.now() - start));
      setResponse(data);

      if (res.ok) {
        fetchUserProjects();
      }
    } catch (err: any) {
      setHttpStatus(500);
      setLatency(Math.round(performance.now() - start));
      setResponse({ error: err.message || 'Failed to delete project' });
    } finally {
      setDeleteLoading(null);
    }
  };

  const curlSave = `curl -X POST "${window.location.origin}/api/projects/save" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${customToken || 'YOUR_JWT_TOKEN'}" \\
  -d '{
    "project_id": "${projectId}",
    "name": "${projectName}",
    "data": ${projectDataJson}
  }'`;

  return (
    <div
      id="panel-projects-jwt"
      className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-100 text-amber-800">
              PROTECTED
            </span>
            <span className="text-xs font-mono text-slate-500">
              /api/projects/* (JWT Required)
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200">
              req.userId Scoped
            </span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mt-1">
            Authenticated User Projects
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Routes enforce <code className="text-slate-800 font-mono font-semibold">req.userId</code> from the verified token, preventing cross-tenant data access.
          </p>
        </div>

        <button
          type="button"
          id="btn-refresh-projects"
          onClick={fetchUserProjects}
          disabled={fetchLoading || !customToken}
          className="px-3.5 py-1.5 rounded text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-40 self-start sm:self-auto cursor-pointer"
        >
          {fetchLoading ? 'Loading Projects...' : 'Refresh Projects List (GET)'}
        </button>
      </div>

      {/* Token Inspector / Custom Bearer Override */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="jwt-token-input"
            className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Authorization: Bearer &lt;token&gt;
          </label>
          <span className="text-[11px] text-slate-500">
            {customToken ? 'Token active' : 'No token provided (will yield 401)'}
          </span>
        </div>
        <input
          id="jwt-token-input"
          type="text"
          value={customToken}
          onChange={(e) => setCustomToken(e.target.value)}
          placeholder="Paste or enter signed JWT token (e.g. eyJhbGciOi...)"
          className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
        />
        {!customToken && (
          <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
            ⚠️ You are not signed in. Head over to <strong>1. Auth & JWT</strong> tab to register/login and obtain a token, or paste an existing token above.
          </p>
        )}
      </div>

      {/* Grid: Save Form & Current Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Save Form */}
        <form onSubmit={handleSaveProject} className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Save or Update Project (POST /api/projects/save)
          </h3>

          <div>
            <label
              htmlFor="proj-id"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Project Identifier (unique per user)
            </label>
            <input
              id="proj-id"
              type="text"
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="e.g. proj_mobile_01"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="proj-name"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Project Name
            </label>
            <input
              id="proj-name"
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Mobile Dashboard"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="proj-data"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              JSON Data Payload (Optional metadata / settings)
            </label>
            <textarea
              id="proj-data"
              rows={4}
              value={projectDataJson}
              onChange={(e) => setProjectDataJson(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none bg-slate-50/50"
            />
          </div>

          <button
            type="submit"
            id="btn-submit-save-project"
            disabled={saveLoading || !customToken}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saveLoading ? 'Saving to Database...' : 'Save Project (Protected POST)'}
          </button>
        </form>

        {/* Existing Projects List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              User's Projects ({projectsList.length})
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              GET /api/projects/user/:userId
            </span>
          </div>

          {projectsList.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-500 text-xs">
              No projects found for authenticated user. Use the form on the left to save a project.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {projectsList.map((p) => (
                <div
                  key={p.id || p.project_id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      <span className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                        {p.project_id}
                      </span>
                    </div>
                    {p.data && (
                      <pre className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 overflow-x-auto max-w-sm">
                        {typeof p.data === 'string' ? p.data : JSON.stringify(p.data, null, 2)}
                      </pre>
                    )}
                    <span className="text-[10px] text-slate-400 block">
                      Updated: {new Date(p.updated_at).toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteProject(p.project_id)}
                    disabled={deleteLoading === p.project_id}
                    className="px-2.5 py-1 text-[11px] font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {deleteLoading === p.project_id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* cURL Preview */}
          <div className="bg-slate-900 text-slate-200 p-3 rounded text-xs font-mono overflow-x-auto border border-slate-800">
            <pre>{curlSave}</pre>
          </div>
        </div>
      </div>

      {/* Response Box */}
      {response && (
        <div
          id="projects-response-output"
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
                {latency}ms
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
