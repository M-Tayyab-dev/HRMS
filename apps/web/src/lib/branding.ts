'use client';

import { useApi } from './hooks';

export interface Branding {
  copyright: string | null;
  logoVersion: string | null;
  faviconVersion: string | null;
}

/** Platform branding set by the Super Admin (Platform settings → General). Public, cached. */
export function useBranding() {
  const { data } = useApi<Branding>('/public/branding');
  return {
    copyright: data?.copyright ?? null,
    logoUrl: data?.logoVersion ? `/api/v1/public/logo?v=${data.logoVersion}` : null,
    faviconUrl: data?.faviconVersion ? `/api/v1/public/favicon?v=${data.faviconVersion}` : null,
    loaded: !!data,
  };
}
