'use client';

import { useState } from 'react';

import { api } from '@/lib/api-client';
import { useMetagraph } from '@/lib/metagraph-context';
import { useToast } from '@/lib/toast-context';

export default function OperationsPage() {
  const { activeMetagraph } = useMetagraph();
  const { addToast } = useToast();
  const [executing, setExecuting] = useState<string | null>(null);

  const execute = async (action: string, fn: () => Promise<any>) => {
    if (!confirm(`Are you sure you want to ${action}?`)) return;
    setExecuting(action);
    try {
      const result = await fn();
      addToast(result.message || `${action} completed`, 'success');
    } catch (e: any) {
      addToast(e.message, 'error');
    }
    setExecuting(null);
  };

  if (!activeMetagraph)
    return <p className="text-[var(--text-muted)]">No metagraph selected</p>;

  const actions = [
    {
      label: 'Force Health Check',
      description: 'Run an immediate health check cycle',
      action: 'run health check',
      fn: () => api.runCheck(activeMetagraph),
      color: 'var(--accent)',
    },
    {
      label: 'Restart Metagraph',
      description: 'Full metagraph restart (all layers, all nodes)',
      action: 'restart the metagraph',
      fn: () => api.restart(activeMetagraph, 'Manual restart from dashboard'),
      color: 'var(--danger)',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-semibold">Operations</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((a) => (
          <div
            key={a.label}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5"
          >
            <h3 className="font-medium mb-1">{a.label}</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              {a.description}
            </p>
            <button
              onClick={() => execute(a.action, a.fn)}
              disabled={executing !== null}
              className="px-4 py-2 rounded text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: a.color }}
            >
              {executing === a.action ? 'Executing...' : a.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
