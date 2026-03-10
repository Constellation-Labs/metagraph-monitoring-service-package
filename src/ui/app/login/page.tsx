'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login(username, password);
      login(data.accessToken);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8">
        <h1 className="text-xl font-semibold text-center mb-6 text-[var(--accent)]">
          Metagraph Monitor
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)]"
              required
            />
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
