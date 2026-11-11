'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { AuthProvider } from '@/lib/auth';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
