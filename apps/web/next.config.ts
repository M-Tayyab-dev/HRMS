import type { NextConfig } from 'next';

const api = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@hrms/shared'],
  // Same-origin API proxy: session cookies stay SameSite=Strict and no CORS is needed.
  async rewrites() {
  if (process.env.VERCEL) {
    return [];
  }

  return [
    {
      source: '/api/v1/:path*',
      destination: `${api}/api/v1/:path*`,
    },
    // ZKTeco biometric devices call fixed /iclock/* paths (BIO-01).
    {
      source: '/iclock/:path*',
      destination: `${api}/iclock/:path*`,
    },
  ];
},
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
