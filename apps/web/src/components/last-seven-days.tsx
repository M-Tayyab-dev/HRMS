'use client';

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/display';
import { Dialog } from '@/components/ui/overlay';
import { cn, date, todayLocal } from '@/lib/format';

export interface DaySummary {
  date: string;
  holiday: string | null;
  onLeave: { name: string; typeName: string; color: string }[];
  workFromHome: { name: string }[];
}

const isWeekend = (d: string) => [0, 6].includes(new Date(`${d}T00:00:00`).getDay());

/** Small calendar of the last 7 days: who was on leave or working from home, and holidays. Tap a day for names. */
export function LastSevenDays({ days, description }: { days: DaySummary[]; description?: string }) {
  const [open, setOpen] = useState<DaySummary | null>(null);
  const today = todayLocal();
  return (
    <Card>
      <CardHeader
        title="Last 7 days"
        description={description}
        action={<Link className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href="/calendar"><CalendarDays className="h-3.5 w-3.5" aria-hidden /> Open calendar</Link>}
      />
      <CardBody className="p-3">
        <ol className="grid grid-cols-7 gap-1.5" aria-label="Last 7 days">
          {days.map((d) => {
            const busy = d.onLeave.length + d.workFromHome.length;
            return (
              <li key={d.date}>
                <button
                  type="button"
                  onClick={() => setOpen(d)}
                  aria-label={`${date(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}: ${d.holiday ? `${d.holiday}, ` : ''}${d.onLeave.length} on leave, ${d.workFromHome.length} working from home`}
                  className={cn(
                    'flex h-full w-full flex-col items-center gap-1 rounded-md border px-1 py-2 text-center transition-colors hover:border-primary/40 hover:bg-muted/50',
                    d.date === today && 'border-primary bg-primary-soft/50',
                    isWeekend(d.date) && d.date !== today && 'bg-muted/40',
                  )}
                >
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">{date(d.date, { weekday: 'short' })}</span>
                  <span className={cn('text-base font-semibold tabular-nums', d.date === today && 'text-primary')}>{Number(d.date.slice(8))}</span>
                  {d.holiday && <span className="w-full truncate rounded bg-violet-100 px-1 text-[10px] text-violet-800 dark:bg-violet-950 dark:text-violet-200" title={d.holiday}>{d.holiday}</span>}
                  {d.onLeave.length > 0 && <span className="w-full truncate rounded bg-primary-soft px-1 text-[10px] text-primary" title={d.onLeave.map((l) => l.name).join(', ')}>{d.onLeave.length} leave</span>}
                  {d.workFromHome.length > 0 && <span className="w-full truncate rounded bg-emerald-100 px-1 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" title={d.workFromHome.map((w) => w.name).join(', ')}>{d.workFromHome.length} WFH</span>}
                  {!busy && !d.holiday && <span className="text-[10px] text-muted-foreground">—</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </CardBody>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open ? date(open.date, { weekday: 'long', day: 'numeric', month: 'long' }) : ''} size="sm">
        {open && (
          <div className="space-y-3 text-sm">
            {open.holiday && <p>Holiday: <strong>{open.holiday}</strong></p>}
            <div>
              <p className="font-medium">On leave ({open.onLeave.length})</p>
              {open.onLeave.length ? (
                <ul className="mt-1 space-y-1">{open.onLeave.map((l, i) => <li key={i} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: l.color }} aria-hidden />{l.name} <span className="text-muted-foreground">· {l.typeName}</span></li>)}</ul>
              ) : <p className="text-muted-foreground">Nobody.</p>}
            </div>
            <div>
              <p className="font-medium">Working from home ({open.workFromHome.length})</p>
              {open.workFromHome.length ? <ul className="mt-1 space-y-1">{open.workFromHome.map((w, i) => <li key={i}>{w.name}</li>)}</ul> : <p className="text-muted-foreground">Nobody.</p>}
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}
