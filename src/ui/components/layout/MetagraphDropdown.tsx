'use client';

import { useState, useRef, useEffect } from 'react';

import { useMetagraph } from '@/lib/metagraph-context';

const healthColors: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  critical: 'bg-red-500',
  unknown: 'bg-gray-500',
};

export function MetagraphDropdown() {
  const { metagraphs, activeMetagraph, setActiveMetagraph } = useMetagraph();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const active = metagraphs.find((m) => m.name === activeMetagraph);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-sm hover:border-[var(--accent)]/50 transition-colors"
      >
        {active && (
          <span
            className={`w-2 h-2 rounded-full ${healthColors[active.health] || healthColors.unknown}`}
          />
        )}
        <span>{activeMetagraph || 'Select metagraph'}</span>
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && metagraphs.length > 0 && (
        <div className="absolute right-0 mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden">
          {metagraphs.map((m) => (
            <button
              key={m.name}
              onClick={() => {
                setActiveMetagraph(m.name);
                setOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-card-hover)] transition-colors ${
                m.name === activeMetagraph ? 'bg-[var(--accent)]/5' : ''
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${healthColors[m.health] || healthColors.unknown}`}
              />
              <span className="flex-1">{m.name}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {m.nodeCount} nodes
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
