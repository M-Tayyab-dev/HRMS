'use client';

import { useBranding } from '@/lib/branding';
import { SITE } from '@/lib/site';

/** Sign-in page footer; the text is set by the Super Admin (Platform settings → General). */
export function SiteCopyright({ className }: { className?: string }) {
  const { copyright } = useBranding();
  return <p className={className}>{copyright || `© ${new Date().getFullYear()} ${SITE.name}`}</p>;
}
