'use client';

import { PERMISSIONS as P, calendarEventSchema } from '@hrms/shared';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DepartmentSelect, EmployeeSelect } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Card, CardBody, PageHeader, Skeleton } from '@/components/ui/display';
import { Field, FormGrid, Input, Select, Textarea } from '@/components/ui/form';
import { Dialog } from '@/components/ui/overlay';
import { qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fieldError, useZodForm } from '@/lib/form';
import { cn, hours, monthLabel, time, todayLocal } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface Cal {
  colors: Record<string, string>;
  holidays: { id: string; name: string; date: string }[];
  events: { id: string; title: string; startDate: string; endDate: string; visibility: string; description: string | null }[];
  attendance: { date: string; status: string; workedMinutes: number; overtimeMinutes: number; lateMinutes: number; checkIn: string | null; checkOut: string | null }[];
  leaves: { id: string; startDate: string; endDate: string; status: string; currentStep: string | null; cancellationStatus: string | null; typeName: string; color: string; halfDay: boolean }[];
  overtime: { date: string; minutes: number; status: string }[];
  birthdays: { id: string; fullName: string; day: number }[];
}

const LEGEND: [string, string][] = [['PRESENT', 'Satisfactory'], ['LATE', 'Late / irregular'], ['ABSENT', 'Absent'], ['ON_LEAVE', 'Leave'], ['HOLIDAY', 'Holiday']];
const shift = (m: string, n: number) => { const [y, mo] = m.split('-').map(Number) as [number, number]; const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const leaveStatusLabel = (l: Cal['leaves'][number]) => (l.status === 'CANCELLED' ? 'cancelled' : l.status === 'PENDING' ? `pending ${l.currentStep === 'HR' ? 'HR' : 'Team Lead'}` : l.status.toLowerCase());

function EventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useZodForm(calendarEventSchema, { title: '', startDate: todayLocal(), endDate: todayLocal(), visibility: 'COMPANY', departmentId: null });
  const vis = form.watch('visibility');
  const add = useAction('post', '/calendar/events', { invalidate: ['/calendar'], success: 'Event added', onSuccess: () => { onOpenChange(false); form.reset(); } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add calendar event" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={add.isPending} onClick={form.handleSubmit((v) => add.mutate(v))}>Add event</Button></>}>
      <div className="space-y-4">
        <Field label="Title" required error={fieldError(form, 'title')}>{(a) => <Input {...a} {...form.register('title')} />}</Field>
        <FormGrid>
          <Field label="Starts" required error={fieldError(form, 'startDate')}>{(a) => <Input {...a} type="date" {...form.register('startDate')} />}</Field>
          <Field label="Ends" required error={fieldError(form, 'endDate')}>{(a) => <Input {...a} type="date" {...form.register('endDate')} />}</Field>
        </FormGrid>
        <FormGrid>
          <Field label="Visible to">{(a) => <Select {...a} {...form.register('visibility')}><option value="COMPANY">Whole company</option><option value="DEPARTMENT">One department</option></Select>}</Field>
          {vis === 'DEPARTMENT' && <Field label="Department" error={fieldError(form, 'departmentId')}>{(a) => <DepartmentSelect {...a} {...form.register('departmentId', { setValueAs: (v) => (v === '' ? null : v) })} />}</Field>}
        </FormGrid>
        <Field label="Description">{(a) => <Textarea {...a} rows={2} {...form.register('description')} />}</Field>
      </div>
    </Dialog>
  );
}

export default function CalendarPage() {
  const { can, me, isTeamLead } = useAuth();
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [employeeId, setEmployeeId] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading } = useApi<Cal>(`/calendar${qs({ month, employeeId })}`);
  const canPick = can(P.ATTENDANCE_READ_ALL) || isTeamLead;

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday first
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  }, [month]);

  const dayInfo = (d: string) => ({
    att: data?.attendance.find((a) => a.date === d),
    hol: data?.holidays.filter((h) => h.date === d) ?? [],
    ev: data?.events.filter((e) => e.startDate <= d && e.endDate >= d) ?? [],
    lv: data?.leaves.filter((l) => l.startDate <= d && l.endDate >= d) ?? [],
    ot: data?.overtime.find((o) => o.date === d),
    bd: data?.birthdays.filter((b) => b.day === Number(d.slice(8))) ?? [],
  });
  const today = todayLocal();
  const sel = selected ? dayInfo(selected) : null;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Your attendance, leave, holidays and company events."
        actions={<>
          {canPick && <EmployeeSelect aria-label="Show calendar for" className="w-56" placeholder={`Me (${me?.employee?.fullName ?? ''})`} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />}
          {can(P.CALENDAR_MANAGE) && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add event</Button>}
        </>}
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => shift(m, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="w-40 text-center font-semibold" aria-live="polite">{monthLabel(month)}</h2>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth((m) => shift(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(today.slice(0, 7))}>Today</Button>
          </div>
          <ul className="flex flex-wrap gap-3 text-xs" aria-label="Legend">
            {LEGEND.map(([k, l]) => <li key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: data?.colors[k] ?? '#999' }} aria-hidden />{l}</li>)}
          </ul>
        </div>
        {isLoading ? <Skeleton className="m-4 h-96" /> : (
          <div className="grid grid-cols-7 text-sm" role="grid" aria-label={monthLabel(month)}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} role="columnheader" className="border-b px-2 py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="min-h-24 border-r border-b bg-muted/30" />;
              const x = dayInfo(d);
              const color = x.att ? data?.colors[x.att.status] : x.hol.length ? data?.colors.HOLIDAY : undefined;
              return (
                <button key={d} role="gridcell" onClick={() => setSelected(d)} className={cn('min-h-24 border-r border-b p-1.5 text-left align-top transition-colors hover:bg-muted/50 focus-visible:bg-muted/50', d === today && 'bg-primary-soft/50')}>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-xs font-medium', d === today && 'rounded-full bg-primary px-1.5 text-white')}>{Number(d.slice(8))}</span>
                    {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} title={x.att?.status ?? 'Holiday'} />}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {x.hol.map((h) => <p key={h.id} className="truncate rounded bg-violet-100 px-1 text-[11px] text-violet-800 dark:bg-violet-950 dark:text-violet-200">{h.name}</p>)}
                    {x.lv.map((l) => <p key={l.id} className={cn('truncate rounded px-1 text-[11px] text-white', l.status !== 'APPROVED' && 'opacity-60', l.status === 'CANCELLED' && 'line-through')} style={{ background: l.status === 'REJECTED' ? '#94a3b8' : l.color }}>{l.typeName} · {leaveStatusLabel(l)}</p>)}
                    {x.ev.map((e) => <p key={e.id} className="truncate rounded bg-sky-100 px-1 text-[11px] text-sky-800 dark:bg-sky-950 dark:text-sky-200">{e.title}</p>)}
                    {x.ot && <p className="truncate text-[11px] text-success">+{hours(x.ot.minutes)} OT</p>}
                    {x.bd.map((b) => <p key={b.id} className="truncate text-[11px]">🎂 {b.fullName}</p>)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} title={selected ? new Date(`${selected}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''} size="sm">
        {sel && (
          <CardBody className="space-y-3 p-0 text-sm">
            {sel.att ? (
              <div><p className="font-medium">Attendance: {sel.att.status.replace('_', ' ').toLowerCase()}</p><p className="text-muted-foreground">{time(sel.att.checkIn)} – {time(sel.att.checkOut)} · {hours(sel.att.workedMinutes)} worked{sel.att.lateMinutes ? ` · ${sel.att.lateMinutes}m late` : ''}{sel.att.overtimeMinutes ? ` · ${hours(sel.att.overtimeMinutes)} overtime` : ''}</p></div>
            ) : <p className="text-muted-foreground">No attendance record.</p>}
            {sel.lv.map((l) => <p key={l.id}>{l.typeName}{l.halfDay ? ' (half day)' : ''}: <strong>{leaveStatusLabel(l)}</strong></p>)}
            {sel.hol.map((h) => <p key={h.id}>🏖 {h.name}</p>)}
            {sel.ev.map((e) => <div key={e.id}><p className="font-medium">{e.title}</p>{e.description && <p className="text-muted-foreground">{e.description}</p>}</div>)}
            {sel.bd.map((b) => <p key={b.id}>🎂 {b.fullName}&apos;s birthday</p>)}
          </CardBody>
        )}
      </Dialog>
      <EventDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
