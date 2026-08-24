import React, { useState, useEffect, useCallback } from 'react';
import { HealthResponse, DeviceRegistration, User } from './types';
import { StatusBanner } from './components/StatusBanner';
import { AuthPanel } from './components/AuthPanel';
import { ProjectsPanel } from './components/ProjectsPanel';
import { DeviceRegisterPanel } from './components/DeviceRegisterPanel';
import { LinkUserPanel } from './components/LinkUserPanel';
import { GithubExchangePanel } from './components/GithubExchangePanel';
import { DatabaseTablePanel } from './components/DatabaseTablePanel';
import { DocsPanel } from './components/DocsPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'auth' | 'projects' | 'register-device' | 'link-user' | 'github' | 'records' | 'docs'
  >('auth');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [devices, setDevices] = useState<DeviceRegistration[]>([]);
  const [devicesLoading, setDevicesLoading] = useState<boolean>(false);

  // Authentication State
  const [authToken, setAuthToken] = useState<string>(() => {
    return localStorage.getItem('auth_jwt_token') || '';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const handleAuthSuccess = (token: string, user: User) => {
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem('auth_jwt_token', token);
    localStorage.setItem('auth_user_profile', JSON.stringify(user));
    fetchHealth();
    fetchDevices();
  };

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    localStorage.removeItem('auth_jwt_token');
    localStorage.removeItem('auth_user_profile');
  };

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      console.error('Failed to fetch /health:', err);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error('Failed to fetch /api/devices:', err);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchDevices();
  }, [fetchHealth, fetchDevices]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Health & Environment Overview */}
        <StatusBanner
          health={health}
          loading={healthLoading}
          onRefresh={fetchHealth}
        />

        {/* Navigation Tabs */}
        <div className="bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm flex flex-wrap gap-1">
          <button
            id="tab-btn-auth"
            onClick={() => setActiveTab('auth')}
            className={`px-3.5 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'auth'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            1. Auth & JWT (Bcrypt)
          </button>

          <button
            id="tab-btn-projects"
            onClick={() => setActiveTab('projects')}
            className={`px-3.5 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'projects'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            2. Projects (req.userId)
          </button>

          <button
            id="tab-btn-register-device"
            onClick={() => setActiveTab('register-device')}
            className={`px-3.5 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'register-device'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            3. Register Device
          </button>

          <button
            id="tab-btn-link-user"
            onClick={() => setActiveTab('link-user')}
            className={`px-3.5 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'link-user'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            4. Link User (JWT)
          </button>

          <button
            id="tab-btn-records"
            onClick={() => setActiveTab('records')}
            className={`px-3.5 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'records'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Database Records
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'records'
                  ? 'bg-slate-700 text-slate-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {devices.length}
            </span>
          </button>

          <button
            id="tab-btn-github"
            onClick={() => setActiveTab('github')}
            className={`px-3.5 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'github'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            GitHub OAuth
          </button>

          <button
            id="tab-btn-docs"
            onClick={() => setActiveTab('docs')}
            className={`px-3.5 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ml-auto ${
              activeTab === 'docs'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            API Docs & Specs
          </button>
        </div>

        {/* Tab Content Panels */}
        {activeTab === 'auth' && (
          <AuthPanel
            authToken={authToken}
            currentUser={currentUser}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsPanel
            authToken={authToken}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'register-device' && (
          <DeviceRegisterPanel onSuccess={fetchDevices} />
        )}

        {activeTab === 'link-user' && (
          <LinkUserPanel
            authToken={authToken}
            currentUser={currentUser}
            onSuccess={fetchDevices}
          />
        )}

        {activeTab === 'records' && (
          <DatabaseTablePanel
            devices={devices}
            loading={devicesLoading}
            onRefresh={fetchDevices}
          />
        )}

        {activeTab === 'github' && <GithubExchangePanel />}

        {activeTab === 'docs' && <DocsPanel />}
      </div>
    </div>
  );
}
