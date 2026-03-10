'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api-client';
import { useMetagraph } from '@/lib/metagraph-context';
import { useToast } from '@/lib/toast-context';

export default function SettingsPage() {
  const { activeMetagraph } = useMetagraph();
  const { addToast } = useToast();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);

  useEffect(() => {
    if (!activeMetagraph) return;
    const fetchConfig = async () => {
      try {
        const [cfg, status] = await Promise.all([
          api.getConfig(activeMetagraph),
          api.getStatus(activeMetagraph),
        ]);
        setConfig(cfg);
        setMonitoringEnabled(status.monitoringLoopRunning);
      } catch {}
      setLoading(false);
    };
    fetchConfig();
  }, [activeMetagraph]);

  const toggleMonitoring = async () => {
    if (!activeMetagraph) return;
    try {
      const result = await api.toggleMonitoring(
        activeMetagraph,
        !monitoringEnabled,
      );
      setMonitoringEnabled(result.enabled);
      addToast(
        `Monitoring ${result.enabled ? 'enabled' : 'paused'}`,
        'success',
      );
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  if (!activeMetagraph)
    return <p className="text-[var(--text-muted)]">No metagraph selected</p>;
  if (loading) return <p className="text-[var(--text-muted)]">Loading...</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Monitoring Toggle */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Monitoring Loop</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Enable or pause the automatic health check loop
            </p>
          </div>
          <button
            onClick={toggleMonitoring}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              monitoringEnabled
                ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20'
                : 'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20'
            }`}
          >
            {monitoringEnabled ? 'Enabled' : 'Paused'}
          </button>
        </div>
      </div>

      {/* Config Summary */}
      {config && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 space-y-4">
          <h3 className="font-medium">Configuration</h3>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[var(--text-muted)]">Metagraph ID</p>
              <p className="font-mono">{config.metagraphId}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Version</p>
              <p>{config.metagraphVersion}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Network</p>
              <p>{config.networkName}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Check Interval</p>
              <p>{config.checkIntervalMinutes} minutes</p>
            </div>
          </div>

          <div>
            <p className="text-[var(--text-muted)] text-sm mb-2">
              Restart Conditions
            </p>
            <div className="flex flex-wrap gap-2">
              {config.restartConditions?.map((c: string) => (
                <span
                  key={c}
                  className="px-2 py-1 rounded bg-[var(--bg)] text-xs border border-[var(--border)]"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[var(--text-muted)] text-sm mb-2">Layers</p>
            <div className="flex gap-3">
              {['ml0', 'cl1', 'dl1'].map((layer) => {
                const l = config.layers?.[layer];
                return (
                  <div
                    key={layer}
                    className="px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-xs"
                  >
                    <span className="font-medium uppercase">{layer}</span>
                    <span
                      className={`ml-2 ${l?.enabled ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}
                    >
                      {l?.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
