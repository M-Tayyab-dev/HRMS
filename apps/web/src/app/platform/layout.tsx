import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand';

export const metadata: Metadata = { title: 'Platform console' };

/** SaaS operator area: separate from company workspaces. */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <BrandLogo />
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">Platform console</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
