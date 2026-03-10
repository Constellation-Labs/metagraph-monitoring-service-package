'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api-client';
import { useMetagraph } from '@/lib/metagraph-context';
import { formatUptime } from '@/lib/time-utils';

const healthColors: Record<string, string> = {
  healthy: 'text-[var(--success)]',
  degraded: 'text-[var(--warning)]',
  critical: 'text-[var(--danger)]',
  unknown: 'text-[var(--text-muted)]',
};

const healthBg: Record<string, string> = {
  healthy: 'bg-green-500/10 border-green-500/20',
  degraded: 'bg-yellow-500/10 border-yellow-500/20',
  critical: 'bg-red-500/10 border-red-500/20',
  unknown: 'bg-gray-500/10 border-gray-500/20',
};

const nodeHealthDot: Record<string, string> = {
  healthy: 'bg-green-500',
  unhealthy: 'bg-red-500',
  forked: 'bg-yellow-500',
  unknown: 'bg-gray-500',
};

export default function DashboardPage() {
  const { activeMetagraph } = useMetagraph();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeMetagraph) return;
    setLoading(true);
    const fetchStatus = async () => {
      try {
        const data = await api.getStatus(activeMetagraph);
        setStatus(data);
      } catch {}
      setLoading(false);
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [activeMetagraph]);

  if (!activeMetagraph) {
    return <p className="text-[var(--text-muted)]">No metagraph selected</p>;
  }

  if (loading && !status) {
    return <p className="text-[var(--text-muted)]">Loading...</p>;
  }

  if (!status) return null;

  const nodes = status.nodes || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{status.metagraphName}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            ID: {status.metagraphId}
          </p>
        </div>
        <div
          className={`px-4 py-2 rounded-lg border ${healthBg[status.overallHealth] || healthBg.unknown}`}
        >
          <span
            className={`text-sm font-medium uppercase ${healthColors[status.overallHealth] || healthColors.unknown}`}
          >
            {status.overallHealth}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Uptime" value={formatUptime(status.uptimeSeconds)} />
        <StatCard
          label="Snapshot"
          value={status.lastSnapshotOrdinal?.toLocaleString() ?? '-'}
        />
        <StatCard label="Polls" value={status.pollCount} />
        <StatCard label="Restarts" value={status.restartCount} />
      </div>

      {/* Monitoring Status */}
      {!status.monitoringLoopRunning && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-[var(--warning)]">
          Monitoring is paused
        </div>
      )}

      {/* Alerts */}
      {status.activeAlerts?.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-[var(--danger)] mb-1">
            Active Alerts
          </p>
          {status.activeAlerts.map((alert: string, i: number) => (
            <p key={i} className="text-sm text-[var(--text-muted)]">
              {alert}
            </p>
          ))}
        </div>
      )}

      {/* Node Grid */}
      <div>
        <h2 className="text-lg font-medium mb-3">
          Nodes ({status.healthyNodeCount}/{status.nodeCount} healthy)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {nodes.map((node: any, i: number) => (
            <div
              key={i}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent)]/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono">{node.ip}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  Node {i}
                </span>
              </div>
              <div className="flex gap-3">
                <LayerStatus label="ML0" status={node.ml0Health} />
                <LayerStatus label="CL1" status={node.cl1Health} />
                <LayerStatus label="DL1" status={node.dl1Health} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-3">
      <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function LayerStatus({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full ${nodeHealthDot[status] || nodeHealthDot.unknown}`}
      />
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </div>
  );
}
