import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { SITE } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.tagline,
  robots: { index: false, follow: false },
  // Served by the API: the Super Admin's favicon, or the built-in icon.
  icons: { icon: '/api/v1/public/favicon' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading headers makes every page dynamic so the CSP nonce is applied to Next's scripts.
  await headers();
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body>. */}
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
