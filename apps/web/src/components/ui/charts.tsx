/**
 * Lightweight, dependency-free SVG charts (ADB-02, ADB-04, DSH-07).
 * Every chart has a text alternative for screen readers.
 */
import { cn } from '@/lib/format';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function Donut({ slices, center, sub, className }: { slices: DonutSlice[]; center?: string; sub?: string; className?: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const desc = slices.map((s) => `${s.label}: ${s.value}`).join(', ');
  return (
    <div className={cn('flex flex-wrap items-center gap-6', className)}>
      <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0" role="img" aria-label={desc}>
        <g transform="rotate(-90 50 50)">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
          {total > 0 &&
            slices.map((s) => {
              const len = (s.value / total) * c;
              const el = <circle key={s.label} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
              offset += len;
              return el;
            })}
        </g>
        {center && <text x="50" y={sub ? 50 : 54} textAnchor="middle" className="fill-foreground text-[14px] font-semibold">{center}</text>}
        {sub && <text x="50" y="63" textAnchor="middle" className="fill-muted-foreground text-[8px]">{sub}</text>}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical bars with an optional reference value per bar (e.g. worked vs shift hours). */
export function Bars({
  items,
  format = (n) => String(n),
  height = 160,
}: {
  items: { label: string; value: number; target?: number; color?: string; title?: string }[];
  format?: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...items.map((i) => Math.max(i.value, i.target ?? 0)));
  if (!items.length) return <p className="py-8 text-center text-sm text-muted-foreground">No data for this period</p>;
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-fit items-end gap-1" style={{ height }} role="list">
        {items.map((i) => (
          <div key={i.label} role="listitem" className="relative flex w-5 shrink-0 flex-col items-center justify-end sm:w-6" style={{ height }} title={i.title ?? `${i.label}: ${format(i.value)}`}>
            {i.target !== undefined && i.target > 0 && (
              <div className="absolute left-0 right-0 border-t-2 border-dashed border-muted-foreground/60" style={{ bottom: `${(i.target / max) * 100}%` }} aria-hidden />
            )}
            <div className="w-full rounded-t-sm" style={{ height: `${(i.value / max) * 100}%`, background: i.color ?? 'var(--primary)' }} />
            <span className="sr-only">{`${i.label}: ${format(i.value)}${i.target ? ` of ${format(i.target)}` : ''}`}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex min-w-fit gap-1" aria-hidden>
        {items.map((i) => (
          <span key={i.label} className="w-5 shrink-0 text-center text-[10px] text-muted-foreground sm:w-6">{i.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Simple line chart for percentages or amounts over time. */
export function Line({ points, format = (n) => String(n), max: fixedMax }: { points: { label: string; value: number | null }[]; format?: (n: number) => string; max?: number }) {
  const w = 300;
  const h = 120;
  const pad = 16;
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  const max = fixedMax ?? Math.max(1, ...vals);
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const path = points
    .map((p, i) => (p.value === null ? null : `${x(i)},${y(p.value)}`))
    .filter(Boolean)
    .join(' L ');
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h + 14}`} className="w-full" role="img" aria-label={points.map((p) => `${p.label}: ${p.value === null ? 'no data' : format(p.value)}`).join(', ')}>
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--border)" />
        {path && <path d={`M ${path}`} fill="none" stroke="var(--primary)" strokeWidth="2" />}
        {points.map((p, i) =>
          p.value === null ? null : (
            <g key={p.label}>
              <circle cx={x(i)} cy={y(p.value)} r="3" fill="var(--primary)" />
              <text x={x(i)} y={y(p.value) - 7} textAnchor="middle" className="fill-foreground text-[9px]">{format(p.value)}</text>
            </g>
          ),
        )}
        {points.map((p, i) => (
          <text key={`l${p.label}`} x={x(i)} y={h + 8} textAnchor="middle" className="fill-muted-foreground text-[9px]">{p.label}</text>
        ))}
      </svg>
    </figure>
  );
}
