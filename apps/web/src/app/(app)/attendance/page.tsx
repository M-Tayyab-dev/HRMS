'use client';

import { PERMISSIONS as P, attendanceCorrectionSchema } from '@hrms/shared';
import { Copy, Cpu, FileUp, Home, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DecisionButtons, DepartmentSelect, EmployeeSelect } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, PageHeader, Stat, StatusBadge } from '@/components/ui/display';
import { Checkbox, Field, FormGrid, Input, Textarea } from '@/components/ui/form';
import { Dialog, Tabs } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fieldError, useZodForm } from '@/lib/form';
import { date, dateTime, hours, monthLabel, time, todayLocal } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface Day { id: string; date: string; status: string; checkIn: string | null; checkOut: string | null; breakMinutes: number; workedMinutes: number; scheduledMinutes: number; lateMinutes: number; overtimeMinutes: number; skippedBreak: boolean; earlyLeave: boolean; workFromHome: boolean; employeeName: string }
interface Correction { id: string; employeeName: string; date: string; checkIn: string | null; checkOut: string | null; reason: string; status: string; currentStep: string | null; createdAt: string; canDecide: boolean }

const monthBounds = (m: string) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const last = new Date(y, mo, 0).getDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` };
};

function CorrectionDialog({ open, onOpenChange, defaultDate }: { open: boolean; onOpenChange: (o: boolean) => void; defaultDate?: string }) {
  const form = useZodForm(attendanceCorrectionSchema, { date: defaultDate ?? todayLocal(), reason: '' });
  const submit = useAction('post', '/attendance/corrections', { invalidate: ['/attendance'], success: 'Correction sent to your Team Lead', onSuccess: () => { onOpenChange(false); form.reset(); } });
  const empty = { setValueAs: (v: string) => (v === '' ? undefined : v) };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Request attendance correction" description="Reviewed by your Team Lead, then HR."
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={submit.isPending} onClick={form.handleSubmit((v) => submit.mutate(v))}>Submit</Button></>}>
      <div className="space-y-4">
        <Field label="Date" required error={fieldError(form, 'date')}>{(a) => <Input {...a} type="date" max={todayLocal()} {...form.register('date')} />}</Field>
        <FormGrid>
          <Field label="Correct check-in" error={fieldError(form, 'checkIn')}>{(a) => <Input {...a} type="time" {...form.register('checkIn', empty)} />}</Field>
          <Field label="Correct check-out" error={fieldError(form, 'checkOut')}>{(a) => <Input {...a} type="time" {...form.register('checkOut', empty)} />}</Field>
        </FormGrid>
        <Field label="Reason" required error={fieldError(form, 'reason')}>{(a) => <Textarea {...a} rows={3} {...form.register('reason')} />}</Field>
      </div>
    </Dialog>
  );
}

function MyAttendance() {
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const { from, to } = monthBounds(month);
  const { data: days, isLoading } = useApi<Day[]>(`/attendance/days${qs({ from, to })}`);
  const { data: corrections } = useApi<Correction[]>('/attendance/corrections?mine=true');
  const [corr, setCorr] = useState<{ open: boolean; date?: string }>({ open: false });
  const sum = useMemo(() => {
    const d = days ?? [];
    return { worked: d.reduce((a, x) => a + x.workedMinutes, 0), scheduled: d.reduce((a, x) => a + x.scheduledMinutes, 0), ot: d.reduce((a, x) => a + x.overtimeMinutes, 0), late: d.filter((x) => x.status === 'LATE').length, absent: d.filter((x) => x.status === 'ABSENT').length };
  }, [days]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input type="month" className="w-auto" aria-label="Month" value={month} max={todayLocal().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
        <Button variant="outline" onClick={() => setCorr({ open: true })}><Plus className="h-4 w-4" /> Request correction</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hours worked" value={hours(sum.worked)} hint={`of ${hours(sum.scheduled)} scheduled`} />
        <Stat label="Overtime" tone="success" value={hours(sum.ot)} />
        <Stat label="Late / irregular days" tone="warning" value={sum.late} />
        <Stat label="Absences" tone="danger" value={sum.absent} />
      </div>
      <Card>
        <CardHeader title={monthLabel(month)} description="Captured from the biometric device. Skipped your break? You may leave early by the break length." />
        <DataTable loading={isLoading} rows={days} rowKey={(d) => d.id} empty="No attendance recorded this month" columns={[
          { key: 'd', header: 'Date', cell: (d) => <span className="whitespace-nowrap">{date(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span> },
          { key: 'in', header: 'In / out', cell: (d) => <span className="tabular-nums">{time(d.checkIn)} – {time(d.checkOut)}</span> },
          { key: 'w', header: 'Worked', cell: (d) => <span className="tabular-nums">{hours(d.workedMinutes)}</span> },
          { key: 'b', header: 'Break', hideOnMobile: true, cell: (d) => (d.skippedBreak ? <Badge tone="info">skipped</Badge> : <span className="text-muted-foreground">{hours(d.breakMinutes)}</span>) },
          { key: 'x', header: 'Notes', hideOnMobile: true, cell: (d) => <div className="flex flex-wrap gap-1">{d.lateMinutes > 0 && <Badge tone="warning">{d.lateMinutes}m late</Badge>}{d.earlyLeave && <Badge tone="warning">left early</Badge>}{d.overtimeMinutes > 0 && <Badge tone="success">+{hours(d.overtimeMinutes)} OT</Badge>}{d.workFromHome && <Badge tone="info">WFH</Badge>}</div> },
          { key: 's', header: 'Status', cell: (d) => <StatusBadge status={d.status} /> },
          { key: 'c', header: '', cell: (d) => (['ABSENT', 'LATE'].includes(d.status) ? <Button size="sm" variant="ghost" onClick={() => setCorr({ open: true, date: d.date })}>Correct</Button> : null) },
        ]} />
      </Card>
      {!!corrections?.length && (
        <Card>
          <CardHeader title="My correction requests" />
          <DataTable rows={corrections} rowKey={(c) => c.id} columns={[
            { key: 'd', header: 'Date', cell: (c) => date(c.date) },
            { key: 't', header: 'Requested', cell: (c) => `${c.checkIn?.slice(0, 5) ?? '—'} – ${c.checkOut?.slice(0, 5) ?? '—'}` },
            { key: 'r', header: 'Reason', hideOnMobile: true, cell: (c) => <span className="text-muted-foreground">{c.reason}</span> },
            { key: 's', header: 'Status', cell: (c) => <StatusBadge status={c.status} step={c.currentStep} /> },
          ]} />
        </Card>
      )}
      <CorrectionDialog open={corr.open} defaultDate={corr.date} onOpenChange={(o) => setCorr({ open: o })} />
    </div>
  );
}

interface DailyRow { employeeId: string; employeeCode: string; fullName: string; departmentName: string; status: string; checkIn: string | null; checkOut: string | null; workedMinutes: number | null; lateMinutes: number | null; overtimeMinutes: number | null }
interface MonthlyRow { employeeId: string; employeeCode: string; fullName: string; departmentName: string; present: number; late: number; absent: number; onLeave: number; halfDay: number; workedMinutes: number; scheduledMinutes: number; lateMinutes: number; overtimeMinutes: number }

function Reports() {
  const [day, setDay] = useState(todayLocal());
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [dept, setDept] = useState('');
  const { data: daily, isLoading: dl } = useApi<{ date: string; rows: DailyRow[] }>(`/attendance/daily${qs({ date: day, departmentId: dept })}`);
  const { data: monthly, isLoading: ml } = useApi<MonthlyRow[]>(`/attendance/monthly${qs({ month, departmentId: dept })}`);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const r of daily?.rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1; return c; }, [daily]);
  const exportCsv = () => {
    if (!monthly) return;
    const head = 'Employee ID,Name,Department,Present,Late,Absent,On leave,Half day,Worked hours,Scheduled hours,Late minutes,Overtime hours';
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = monthly.map((r) => [r.employeeCode, esc(r.fullName), esc(r.departmentName), r.present, r.late, r.absent, r.onLeave, r.halfDay, (r.workedMinutes / 60).toFixed(1), (r.scheduledMinutes / 60).toFixed(1), r.lateMinutes, (r.overtimeMinutes / 60).toFixed(1)].join(','));
    const url = URL.createObjectURL(new Blob([[head, ...lines].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-6">
      <DepartmentSelect includeAll="All departments" className="w-auto" aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} />
      <Card>
        <CardHeader title="Daily report" description={Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase().replace(/_/g, ' ')}`).join(' · ')} action={<Input type="date" className="w-auto" aria-label="Date" value={day} onChange={(e) => setDay(e.target.value)} />} />
        <DataTable loading={dl} rows={daily?.rows} rowKey={(r) => r.employeeId} columns={[
          { key: 'n', header: 'Employee', cell: (r) => <div><p className="font-medium">{r.fullName}</p><p className="text-xs text-muted-foreground">{r.employeeCode} · {r.departmentName}</p></div> },
          { key: 'i', header: 'In / out', cell: (r) => `${time(r.checkIn)} – ${time(r.checkOut)}` },
          { key: 'w', header: 'Worked', hideOnMobile: true, cell: (r) => hours(r.workedMinutes ?? 0) },
          { key: 'l', header: 'Late', hideOnMobile: true, cell: (r) => (r.lateMinutes ? `${r.lateMinutes}m` : '—') },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
        ]} />
      </Card>
      <Card>
        <CardHeader title="Monthly report" action={<div className="flex gap-2"><Input type="month" className="w-auto" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} /><Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button></div>} />
        <DataTable loading={ml} rows={monthly} rowKey={(r) => r.employeeId} empty="No attendance for this month" columns={[
          { key: 'n', header: 'Employee', cell: (r) => <div><p className="font-medium">{r.fullName}</p><p className="text-xs text-muted-foreground">{r.departmentName}</p></div> },
          { key: 'p', header: 'Present', cell: (r) => r.present + r.late },
          { key: 'l', header: 'Late', cell: (r) => r.late },
          { key: 'a', header: 'Absent', cell: (r) => r.absent },
          { key: 'v', header: 'Leave', hideOnMobile: true, cell: (r) => r.onLeave },
          { key: 'h', header: 'Hours', cell: (r) => <span className="tabular-nums">{hours(r.workedMinutes)} <span className="text-muted-foreground">/ {hours(r.scheduledMinutes)}</span></span> },
          { key: 'o', header: 'Overtime', hideOnMobile: true, cell: (r) => hours(r.overtimeMinutes) },
        ]} />
      </Card>
    </div>
  );
}

function Approvals() {
  const { data, isLoading } = useApi<Correction[]>('/attendance/corrections');
  return (
    <Card>
      <DataTable loading={isLoading} rows={data} rowKey={(c) => c.id} empty="No correction requests" columns={[
        { key: 'e', header: 'Employee', cell: (c) => <span className="font-medium">{c.employeeName}</span> },
        { key: 'd', header: 'Date', cell: (c) => date(c.date) },
        { key: 't', header: 'Requested', cell: (c) => `${c.checkIn?.slice(0, 5) ?? '—'} – ${c.checkOut?.slice(0, 5) ?? '—'}` },
        { key: 'r', header: 'Reason', hideOnMobile: true, cell: (c) => <span className="text-muted-foreground">{c.reason}</span> },
        { key: 's', header: 'Status', cell: (c) => <StatusBadge status={c.status} step={c.currentStep} /> },
        { key: 'a', header: '', cell: (c) => (c.canDecide ? <DecisionButtons path={`/attendance/corrections/${c.id}/decision`} invalidate={['/attendance']} /> : null) },
      ]} />
    </Card>
  );
}

interface Device { id: string; name: string; apiKeyPrefix: string; lastSeenAt: string | null; isActive: boolean }

function Admin() {
  const { data: devices } = useApi<Device[]>('/attendance/devices');
  const [name, setName] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const create = useAction<{ name: string }, { apiKey: string }>('post', '/attendance/devices', { invalidate: ['/attendance/devices'], onSuccess: (r) => { setKey(r.apiKey); setName(''); } });
  const revoke = useAction<string>('del', (id) => `/attendance/devices/${id}`, { invalidate: ['/attendance/devices'], success: 'Device revoked' });
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [wfh, setWfh] = useState({ employeeId: '', date: todayLocal(), workFromHome: true });
  const flag = useAction('post', '/attendance/days/flags', { invalidate: ['/attendance'], success: 'Day updated' });

  const runImport = async () => {
    const punches = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^employee/i.test(l))
      .map((l) => { const [employeeCode, at, type] = l.split(',').map((x) => x.trim()); return { employeeCode: employeeCode!, at: new Date(at!).toISOString(), ...(type ? { type } : {}) }; });
    if (!punches.length) return toast.error('Paste at least one line');
    if (punches.some((p) => p.at === 'Invalid Date')) return toast.error('Some dates could not be read');
    setImporting(true);
    try {
      const r = await api.post<{ inserted: number; received: number; unknownEmployeeCodes: string[] }>('/attendance/import', { punches });
      toast.success(`${r.inserted} of ${r.received} punches imported${r.unknownEmployeeCodes.length ? `. Unknown IDs: ${r.unknownEmployeeCodes.join(', ')}` : ''}`);
      setCsv('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Biometric devices" description="Each device gets its own key and pushes punches to the API." />
        <CardBody className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Device name, e.g. Main entrance" aria-label="Device name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button disabled={name.trim().length < 2} loading={create.isPending} onClick={() => create.mutate({ name })}><Cpu className="h-4 w-4" /> Add</Button>
          </div>
          <ul className="divide-y rounded-md border">
            {!devices?.length && <li className="p-3 text-sm text-muted-foreground">No devices registered.</li>}
            {devices?.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">Key {d.apiKeyPrefix}… · last seen {d.lastSeenAt ? dateTime(d.lastSeenAt) : 'never'}</p></div>
                {d.isActive ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => revoke.mutate(d.id)}>Revoke</Button> : <Badge>revoked</Badge>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Devices POST to <code className="rounded bg-muted px-1">/api/v1/attendance/device/punches</code> with header <code className="rounded bg-muted px-1">X-Device-Key</code>.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Import punches (CSV)" description="One punch per line: employee ID, date-time, optional type (IN/OUT/BREAK_START/BREAK_END)." />
        <CardBody className="space-y-3">
          <Textarea rows={8} className="font-mono text-xs" placeholder={'EMP-0002,2026-11-10T09:02:00+05:00\nEMP-0002,2026-11-10T18:05:00+05:00'} aria-label="CSV data" value={csv} onChange={(e) => setCsv(e.target.value)} />
          <Button onClick={runImport} loading={importing}><FileUp className="h-4 w-4" /> Import</Button>
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Work from home" description="Mark a day as WFH. WFH days don't qualify for food allowance." />
        <CardBody className="flex flex-wrap items-end gap-3">
          <Field label="Employee" className="min-w-60 flex-1">{(a) => <EmployeeSelect {...a} value={wfh.employeeId} onChange={(e) => setWfh({ ...wfh, employeeId: e.target.value })} />}</Field>
          <Field label="Date">{(a) => <Input {...a} type="date" value={wfh.date} max={todayLocal()} onChange={(e) => setWfh({ ...wfh, date: e.target.value })} />}</Field>
          <Checkbox className="mb-2" label="Worked from home" checked={wfh.workFromHome} onChange={(e) => setWfh({ ...wfh, workFromHome: e.target.checked })} />
          <Button disabled={!wfh.employeeId} loading={flag.isPending} onClick={() => flag.mutate(wfh)}><Home className="h-4 w-4" /> Save</Button>
        </CardBody>
      </Card>
      {key && (
        <Dialog open onOpenChange={() => setKey(null)} title="Device key" description="Copy it now. For security it won't be shown again." footer={<Button onClick={() => setKey(null)}>Done</Button>}>
          <div className="flex gap-2">
            <Input readOnly value={key} className="font-mono text-xs" aria-label="Device key" />
            <Button variant="outline" size="icon" aria-label="Copy key" onClick={() => navigator.clipboard.writeText(key).then(() => toast.success('Copied'))}><Copy className="h-4 w-4" /></Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const { can, me } = useAuth();
  return (
    <>
      <PageHeader title="Attendance" description="Biometric check-ins, working hours, late arrivals and corrections." />
      <Tabs tabs={[
        { value: 'me', label: 'My attendance', hidden: !me?.employee, content: <MyAttendance /> },
        { value: 'reports', label: 'Reports', hidden: !can(P.ATTENDANCE_READ_ALL, P.ATTENDANCE_READ_TEAM), content: <Reports /> },
        { value: 'corrections', label: 'Correction approvals', hidden: !can(P.ATTENDANCE_CORRECTION_APPROVE_TL, P.ATTENDANCE_CORRECTION_APPROVE_HR), content: <Approvals /> },
        { value: 'admin', label: 'Devices & import', hidden: !can(P.ATTENDANCE_MANAGE), content: <Admin /> },
      ]} />
    </>
  );
}
