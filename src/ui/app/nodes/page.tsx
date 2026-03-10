'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api-client';
import { useMetagraph } from '@/lib/metagraph-context';
import { useToast } from '@/lib/toast-context';

const statusColor: Record<string, string> = {
  healthy: 'text-[var(--success)]',
  unhealthy: 'text-[var(--danger)]',
  forked: 'text-[var(--warning)]',
  unknown: 'text-[var(--text-muted)]',
};

export default function NodesPage() {
  const { activeMetagraph } = useMetagraph();
  const { addToast } = useToast();
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeMetagraph) return;
    const fetch = async () => {
      try {
        const data = await api.getNodes(activeMetagraph);
        setNodes(data);
      } catch {}
      setLoading(false);
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [activeMetagraph]);

  const handleRestart = async (nodeIndex: number, layers: string[]) => {
    if (!activeMetagraph) return;
    if (!confirm(`Restart node ${nodeIndex} layers: ${layers.join(', ')}?`))
      return;
    try {
      await api.restartNode(activeMetagraph, nodeIndex, layers);
      addToast('Node restart initiated', 'success');
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  if (!activeMetagraph)
    return <p className="text-[var(--text-muted)]">No metagraph selected</p>;
  if (loading) return <p className="text-[var(--text-muted)]">Loading...</p>;

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-semibold">Nodes</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">
                #
              </th>
              <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">
                IP
              </th>
              <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">
                ML0
              </th>
              <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">
                CL1
              </th>
              <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium">
                DL1
              </th>
              <th className="text-right py-3 px-4 text-[var(--text-muted)] font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => (
              <tr
                key={node.index}
                className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
              >
                <td className="py-3 px-4">{node.index}</td>
                <td className="py-3 px-4 font-mono">{node.ip}</td>
                <td
                  className={`py-3 px-4 capitalize ${statusColor[node.ml0Status] || ''}`}
                >
                  {node.ml0Status}
                </td>
                <td
                  className={`py-3 px-4 capitalize ${statusColor[node.cl1Status] || ''}`}
                >
                  {node.cl1Status}
                </td>
                <td
                  className={`py-3 px-4 capitalize ${statusColor[node.dl1Status] || ''}`}
                >
                  {node.dl1Status}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() =>
                      handleRestart(node.index, ['ml0', 'cl1', 'dl1'])
                    }
                    className="text-xs px-2 py-1 rounded bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors"
                  >
                    Restart All
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
