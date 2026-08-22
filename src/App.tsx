import React, { useState, useEffect, useCallback } from 'react';
import { HealthResponse, DeviceRegistration } from './types';
import { StatusBanner } from './components/StatusBanner';
import { DeviceRegisterPanel } from './components/DeviceRegisterPanel';
import { LinkUserPanel } from './components/LinkUserPanel';
import { GithubExchangePanel } from './components/GithubExchangePanel';
import { DatabaseTablePanel } from './components/DatabaseTablePanel';
import { DocsPanel } from './components/DocsPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'register' | 'link' | 'github' | 'records' | 'docs'
  >('register');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [devices, setDevices] = useState<DeviceRegistration[]>([]);
  const [devicesLoading, setDevicesLoading] = useState<boolean>(false);

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

  const handleDeviceActionSuccess = () => {
    fetchHealth();
    fetchDevices();
  };

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
            id="tab-btn-register"
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            1. Register Device (POST)
          </button>

          <button
            id="tab-btn-link"
            onClick={() => setActiveTab('link')}
            className={`px-4 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'link'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            2. Link User (POST)
          </button>

          <button
            id="tab-btn-github"
            onClick={() => setActiveTab('github')}
            className={`px-4 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'github'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            3. GitHub Token Exchange (POST)
          </button>

          <button
            id="tab-btn-records"
            onClick={() => {
              setActiveTab('records');
              fetchDevices();
            }}
            className={`px-4 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === 'records'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Database Records ({devices.length})
          </button>

          <button
            id="tab-btn-docs"
            onClick={() => setActiveTab('docs')}
            className={`px-4 py-2 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer ml-auto ${
              activeTab === 'docs'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            API Specs & Deployment
          </button>
        </div>

        {/* Tab Content Panels */}
        <main className="space-y-6">
          {activeTab === 'register' && (
            <DeviceRegisterPanel onSuccess={handleDeviceActionSuccess} />
          )}

          {activeTab === 'link' && (
            <LinkUserPanel onSuccess={handleDeviceActionSuccess} />
          )}

          {activeTab === 'github' && <GithubExchangePanel />}

          {activeTab === 'records' && (
            <DatabaseTablePanel
              devices={devices}
              loading={devicesLoading}
              onRefresh={fetchDevices}
              onSelectDeviceId={() => {
                setActiveTab('link');
              }}
            />
          )}

          {activeTab === 'docs' && <DocsPanel />}
        </main>
      </div>
    </div>
  );
}
