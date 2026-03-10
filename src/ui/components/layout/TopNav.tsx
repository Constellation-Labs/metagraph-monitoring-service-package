'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MetagraphDropdown } from './MetagraphDropdown';

import { useAuth } from '@/lib/auth-context';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/nodes', label: 'Nodes' },
  { href: '/logs', label: 'Logs' },
  { href: '/operations', label: 'Operations' },
  { href: '/settings', label: 'Settings' },
];

export function TopNav() {
  const pathname = usePathname();
  const { username, logout } = useAuth();

  if (pathname === '/login') return null;

  return (
    <nav className="sticky top-0 z-40 bg-[var(--bg-card)]/80 backdrop-blur border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-[var(--accent)]">
            Metagraph Monitor
          </span>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  pathname === item.href
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <MetagraphDropdown />
          {username && (
            <span className="text-xs text-[var(--text-muted)]">{username}</span>
          )}
          <button
            onClick={logout}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
