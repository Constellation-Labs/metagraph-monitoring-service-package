'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!token && pathname !== '/login') {
      router.push('/login');
    }
  }, [token, pathname, router]);

  if (!token && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
