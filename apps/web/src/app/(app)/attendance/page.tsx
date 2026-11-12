'use client';

import { PERMISSIONS as P, attendanceCorrectionSchema } from '@hrms/shared';
import { Copy, Cpu, FileUp, Home, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DecisionButtons, DepartmentSelect, EmployeeSelect } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, PageHeader, Stat, StatusBadge } from '@/components/ui/display';
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from '@/components/ui/form';
import { Dialog, Tabs } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { Bars, Donut, Line } from '@/components/ui/charts';
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

interface Dash {
  month: string;
  percentage: number | null;
  daysRecorded: number;
  counts: { present: number; late: number; absent: number; leave: number };
  figures: { workedMinutes: number; scheduledMinutes: number; overtimeMinutes: number; lateMinutes: number; averageCheckIn: string | null; averageBreakMinutes: number | null; foodEligibleDays: number | null };
  daily: { date: string; status: string; workedMinutes: number; scheduledMinutes: number }[];
  trend: { month: string; percentage: number | null; late: number }[];
  latest: { date: string; status: string; checkIn: string | null; checkOut: string | null; workedMinutes: number; breakMinutes: number; overtimeMinutes: number; lateMinutes: number }[];
  colors: Record<string, string>;
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

function MyAttendance() {
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [showAll, setShowAll] = useState(false);
  const { from, to } = monthBounds(month);
  const { data: dash, isLoading: dashLoading } = useApi<Dash>(`/attendance/me/dashboard${qs({ month })}`);
  const { data: days, isLoading } = useApi<Day[]>(showAll ? `/attendance/days${qs({ from, to })}` : null);
  const { data: corrections } = useApi<Correction[]>('/attendance/corrections?mine=true');
  const [corr, setCorr] = useState<{ open: boolean; date?: string }>({ open: false });
  const f = dash?.figures;
  const col = (k: string) => dash?.colors[k] ?? '#999';
  const correctBtn = (d: { date: string }) => <Button size="sm" variant="ghost" onClick={() => setCorr({ open: true, date: d.date })}>Request correction</Button>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Input type="month" className="w-auto" aria-label="Month" value={month} max={todayLocal().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
          <div>
            <p className="text-sm font-semibold">{monthLabel(month)}</p>
            <p className="text-xs text-muted-foreground">Attendance {pct(dash?.percentage)}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setCorr({ open: true })}><Plus className="h-4 w-4" /> Request correction</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="This month" description={`${dash?.daysRecorded ?? 0} working days recorded`} />
          <CardBody>
            <Donut
              center={pct(dash?.percentage)}
              sub="attendance"
              slices={[
                { label: 'Present', value: dash?.counts.present ?? 0, color: col('PRESENT') },
                { label: 'Late', value: dash?.counts.late ?? 0, color: col('LATE') },
                { label: 'Absent', value: dash?.counts.absent ?? 0, color: col('ABSENT') },
                { label: 'Leave', value: dash?.counts.leave ?? 0, color: col('ON_LEAVE') },
              ]}
            />
          </CardBody>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-3">
          <Stat label="Total working hours" value={hours(f?.workedMinutes ?? 0)} hint={`of ${hours(f?.scheduledMinutes ?? 0)} shift hours`} />
          <Stat label="Overtime" tone="success" value={hours(f?.overtimeMinutes ?? 0)} />
          <Stat label="Total late time" tone="warning" value={`${f?.lateMinutes ?? 0} min`} />
          <Stat label="Average check-in" value={f?.averageCheckIn ?? '—'} />
          <Stat label="Average break" value={f?.averageBreakMinutes == null ? '—' : `${f.averageBreakMinutes} min`} />
          <Stat label="Food-allowance days" value={f?.foodEligibleDays ?? '—'} hint={f?.foodEligibleDays === null ? 'Not enabled for your department' : 'eligible this month'} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Daily working hours" description="Bars show hours worked; the dashed line is the shift." />
          <CardBody>
            <Bars format={hours} items={(dash?.daily ?? []).map((d) => ({ label: String(Number(d.date.slice(8))), value: d.workedMinutes, target: d.scheduledMinutes, color: col(d.status), title: `${date(d.date)}: ${hours(d.workedMinutes)} of ${hours(d.scheduledMinutes)}` }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="6-month attendance trend" />
          <CardBody>
            <Line max={100} format={(n) => `${n}%`} points={(dash?.trend ?? []).map((t) => ({ label: monthLabel(t.month).slice(0, 3), value: t.percentage }))} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Latest records" description="Your 5 most recent days." action={<Button size="sm" variant="outline" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Hide full history' : 'View all'}</Button>} />
        <DataTable loading={dashLoading} rows={dash?.latest} rowKey={(d) => d.date} empty="No attendance recorded yet" columns={[
          { key: 'd', header: 'Date', cell: (d) => <span className="whitespace-nowrap">{date(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span> },
          { key: 's', header: 'Status', cell: (d) => <StatusBadge status={d.status} /> },
          { key: 'i', header: 'Check-in', cell: (d) => <span className="tabular-nums">{time(d.checkIn)}{d.lateMinutes > 0 && <Badge tone="warning" className="ml-1">{d.lateMinutes}m late</Badge>}</span> },
          { key: 'o', header: 'Check-out', cell: (d) => <span className="tabular-nums">{time(d.checkOut)}</span> },
          { key: 'w', header: 'Working hours', cell: (d) => <span className="tabular-nums">{hours(d.workedMinutes)}</span> },
          { key: 'b', header: 'Break', hideOnMobile: true, cell: (d) => hours(d.breakMinutes) },
          { key: 'ot', header: 'Overtime', hideOnMobile: true, cell: (d) => (d.overtimeMinutes ? hours(d.overtimeMinutes) : '—') },
          { key: 'c', header: '', cell: correctBtn },
        ]} />
      </Card>

      {showAll && (
        <Card>
          <CardHeader title={`Full history · ${monthLabel(month)}`} description="Captured from the biometric device. Skipped your break? You may leave early by the break length." />
          <DataTable loading={isLoading} rows={days} rowKey={(d) => d.id} empty="No attendance recorded this month" columns={[
            { key: 'd', header: 'Date', cell: (d) => <span className="whitespace-nowrap">{date(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span> },
            { key: 'in', header: 'In / out', cell: (d) => <span className="tabular-nums">{time(d.checkIn)} – {time(d.checkOut)}</span> },
            { key: 'w', header: 'Worked', cell: (d) => <span className="tabular-nums">{hours(d.workedMinutes)}</span> },
            { key: 'b', header: 'Break', hideOnMobile: true, cell: (d) => (d.skippedBreak ? <Badge tone="info">skipped</Badge> : <span className="text-muted-foreground">{hours(d.breakMinutes)}</span>) },
            { key: 'x', header: 'Notes', hideOnMobile: true, cell: (d) => <div className="flex flex-wrap gap-1">{d.lateMinutes > 0 && <Badge tone="warning">{d.lateMinutes}m late</Badge>}{d.earlyLeave && <Badge tone="warning">left early</Badge>}{d.overtimeMinutes > 0 && <Badge tone="success">+{hours(d.overtimeMinutes)} OT</Badge>}{d.workFromHome && <Badge tone="info">WFH</Badge>}</div> },
            { key: 's', header: 'Status', cell: (d) => <StatusBadge status={d.status} /> },
            { key: 'c', header: '', cell: correctBtn },
          ]} />
        </Card>
      )}
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

interface Device { id: string; name: string; protocol: 'ZKTECO_ADMS' | 'HIKVISION_ISAPI' | 'GENERIC'; serialNumber: string | null; location: string | null; apiKeyPrefix: string; lastSeenAt: string | null; lastSyncAt: string | null; isActive: boolean; online: boolean }
interface Held { deviceUserId: string; punches: number; firstAt: string; lastAt: string; devices: string | null }

const PROTOCOLS: Record<Device['protocol'], string> = { ZKTECO_ADMS: 'ZKTeco (ADMS / Cloud Server)', HIKVISION_ISAPI: 'Hikvision (ISAPI HTTP listening)', GENERIC: 'Other (JSON API)' };

function DeviceSetup({ protocol, apiKey }: { protocol: Device['protocol']; apiKey?: string }) {
  const host = typeof window !== 'undefined' ? window.location.host : 'your-hrms-domain';
  if (protocol === 'ZKTECO_ADMS') {
    return <p className="text-xs text-muted-foreground">On the device: <b>Comm. → Cloud Server Setting</b>, server address <code className="rounded bg-muted px-1">{host}</code>, port 443 (HTTPS on) or 80. The device is recognised by its serial number; punches stored offline are sent when it reconnects.</p>;
  }
  if (protocol === 'HIKVISION_ISAPI') {
    return <p className="break-all text-xs text-muted-foreground">On the device: <b>Network → Advanced → HTTP Listening</b>, URL <code className="rounded bg-muted px-1">https://{host}/api/v1/attendance/hikvision/{apiKey ?? '<device key>'}</code>, and enable attendance status.</p>;
  }
  return <p className="text-xs text-muted-foreground">POST JSON to <code className="rounded bg-muted px-1">/api/v1/attendance/device/punches</code> with header <code className="rounded bg-muted px-1">X-Device-Key</code>.</p>;
}

function BiometricDevices() {
  const { data: devices } = useApi<Device[]>('/attendance/devices', { refetchInterval: 60_000 });
  const { data: held } = useApi<Held[]>('/attendance/held-punches');
  const [form, setForm] = useState<{ name: string; protocol: Device['protocol']; serialNumber: string; location: string }>({ name: '', protocol: 'ZKTECO_ADMS', serialNumber: '', location: '' });
  const [created, setCreated] = useState<{ apiKey: string; protocol: Device['protocol'] } | null>(null);
  const create = useAction<typeof form, { apiKey: string; protocol: Device['protocol'] }>('post', '/attendance/devices', { invalidate: ['/attendance/devices'], onSuccess: (r) => { setCreated({ apiKey: r.apiKey, protocol: r.protocol }); setForm({ name: '', protocol: form.protocol, serialNumber: '', location: '' }); } });
  const revoke = useAction<string>('del', (id) => `/attendance/devices/${id}`, { invalidate: ['/attendance/devices'], success: 'Device revoked' });
  const [assign, setAssign] = useState<Record<string, string>>({});
  const map = useAction<{ deviceUserId: string; employeeId: string }, { released: number }>('post', '/attendance/held-punches/assign', { invalidate: ['/attendance'], onSuccess: (r) => toast.success(`${r.released} punches added to attendance`) });
  const discard = useAction<{ deviceUserId: string }>('post', '/attendance/held-punches/discard', { invalidate: ['/attendance/held-punches'], success: 'Punches discarded' });
  return (
    <>
      <Card className="lg:col-span-2">
        <CardHeader title="Biometric devices" description="Each device is registered to this company. Devices push punches to the HRMS over the internet; no static IP or VPN needed." />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name" className="lg:col-span-1">{(a) => <Input {...a} placeholder="Main entrance" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Type" className="lg:col-span-2">{(a) => <Select {...a} value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value as Device['protocol'] })}>{Object.entries(PROTOCOLS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
            <Field label={form.protocol === 'ZKTECO_ADMS' ? 'Serial number (required)' : 'Serial number'}>{(a) => <Input {...a} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />}</Field>
            <Field label="Location">{(a) => <Input {...a} placeholder="Head office, ground floor" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
          </div>
          <Button disabled={form.name.trim().length < 2 || (form.protocol === 'ZKTECO_ADMS' && !form.serialNumber.trim())} loading={create.isPending} onClick={() => create.mutate({ ...form, serialNumber: form.serialNumber.trim() || undefined, location: form.location.trim() || undefined } as typeof form)}><Cpu className="h-4 w-4" /> Register device</Button>
          <DeviceSetup protocol={form.protocol} />
          <DataTable rows={devices} rowKey={(d) => d.id} empty="No devices registered" columns={[
            { key: 'n', header: 'Device', cell: (d) => <div><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{PROTOCOLS[d.protocol]}{d.serialNumber ? ` · SN ${d.serialNumber}` : ''}{d.location ? ` · ${d.location}` : ''}</p></div> },
            { key: 's', header: 'Status', cell: (d) => (!d.isActive ? <Badge>revoked</Badge> : d.online ? <Badge tone="success">online</Badge> : <Badge tone="danger">offline</Badge>) },
            { key: 'l', header: 'Last sync', hideOnMobile: true, cell: (d) => <span className="text-xs text-muted-foreground">{d.lastSyncAt ? dateTime(d.lastSyncAt) : 'never'}<br />seen {d.lastSeenAt ? dateTime(d.lastSeenAt) : 'never'}</span> },
            { key: 'x', header: '', cell: (d) => (d.isActive ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => revoke.mutate(d.id)}>Revoke</Button> : null) },
          ]} />
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Unrecognised device users" description="Punches from a device user ID that isn't linked to an employee are held here. Link the ID to an employee to add the punches to attendance." />
        <DataTable rows={held} rowKey={(h) => h.deviceUserId} empty="Nothing waiting – every device user is linked" columns={[
          { key: 'u', header: 'Device user ID', cell: (h) => <span className="font-mono">{h.deviceUserId}</span> },
          { key: 'p', header: 'Punches', cell: (h) => <span>{h.punches}<span className="block text-xs text-muted-foreground">{dateTime(h.firstAt)} – {dateTime(h.lastAt)}</span></span> },
          { key: 'd', header: 'Device', hideOnMobile: true, cell: (h) => h.devices ?? '—' },
          { key: 'a', header: 'Link to employee', cell: (h) => (
            <div className="flex min-w-64 items-center gap-2">
              <EmployeeSelect aria-label={`Employee for device user ${h.deviceUserId}`} value={assign[h.deviceUserId] ?? ''} onChange={(e) => setAssign({ ...assign, [h.deviceUserId]: e.target.value })} />
              <Button size="sm" disabled={!assign[h.deviceUserId]} loading={map.isPending} onClick={() => map.mutate({ deviceUserId: h.deviceUserId, employeeId: assign[h.deviceUserId]! })}>Link</Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => discard.mutate({ deviceUserId: h.deviceUserId })}>Discard</Button>
            </div>
          ) },
        ]} />
      </Card>
      {created && (
        <Dialog open onOpenChange={() => setCreated(null)} title="Device registered" description="Copy the device key now. For security it won't be shown again." footer={<Button onClick={() => setCreated(null)}>Done</Button>}>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={created.apiKey} className="font-mono text-xs" aria-label="Device key" />
              <Button variant="outline" size="icon" aria-label="Copy key" onClick={() => navigator.clipboard.writeText(created.apiKey).then(() => toast.success('Copied'))}><Copy className="h-4 w-4" /></Button>
            </div>
            <DeviceSetup protocol={created.protocol} apiKey={created.apiKey} />
          </div>
        </Dialog>
      )}
    </>
  );
}


function Admin() {
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
      <BiometricDevices />
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
