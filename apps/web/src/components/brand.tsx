import { cn } from '@/lib/format';
import { SITE } from '@/lib/site';

/**
 * Product mark: two people side by side, joined at the middle so together they form an "H"
 * (people + HRMS). Kept in one place so the favicon (app/icon.svg) and every screen match.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8 shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id="hrms-brand-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#hrms-brand-gradient)" />
      <g fill="#fff">
        <circle cx="10.5" cy="9.5" r="3" />
        <circle cx="21.5" cy="9.5" r="3" />
        <rect x="7.5" y="14" width="6" height="12" rx="3" />
        <rect x="18.5" y="14" width="6" height="12" rx="3" />
        <rect x="12" y="17.75" width="8" height="3.5" rx="1.75" />
      </g>
    </svg>
  );
}

/** Mark + product name, for headers. `inverted` for use on dark/colored backgrounds. */
export function BrandLogo({ className, inverted, size = 'md' }: { className?: string; inverted?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandMark className={cn(size === 'sm' && 'h-7 w-7', size === 'md' && 'h-8 w-8', size === 'lg' && 'h-10 w-10', inverted && 'ring-2 ring-white/30 rounded-lg')} />
      <span className={cn('font-semibold tracking-tight', size === 'lg' ? 'text-xl' : 'text-base', inverted ? 'text-white' : 'text-foreground')}>{SITE.name}</span>
    </span>
  );
}

/** The client company's own logo, or its initials when none has been uploaded. */
export function CompanyLogo({ name, logoFileId, className }: { name: string; logoFileId?: string | null; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
  return logoFileId ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/v1/company/logo/${logoFileId}`} alt={`${name} logo`} className={cn('h-9 w-9 shrink-0 rounded-lg border bg-white object-contain p-0.5', className)} />
  ) : (
    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-semibold text-primary', className)} aria-hidden>
      {initials}
    </span>
  );
}
