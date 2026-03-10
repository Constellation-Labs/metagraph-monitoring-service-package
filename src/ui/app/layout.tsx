import type { Metadata } from 'next';

import { AuthGate } from '@/components/auth/AuthGate';
import { ToastContainer } from '@/components/common/ToastContainer';
import { TopNav } from '@/components/layout/TopNav';
import { AuthProvider } from '@/lib/auth-context';
import { MetagraphProvider } from '@/lib/metagraph-context';
import { ToastProvider } from '@/lib/toast-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Metagraph Monitor - Constellation',
  description: 'Constellation metagraph monitoring dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <AuthProvider>
          <ToastProvider>
            <AuthGate>
              <MetagraphProvider>
                <TopNav />
                <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
                <ToastContainer />
              </MetagraphProvider>
            </AuthGate>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
