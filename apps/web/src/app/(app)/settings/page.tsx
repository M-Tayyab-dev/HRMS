'use client';

import { PERMISSIONS as P, workScheduleSchema } from '@hrms/shared';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui/display';
import { Checkbox, Field, FormGrid, Input } from '@/components/ui/form';
import { Dialog, Tabs } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { fieldError, useZodForm } from '@/lib/form';
import { useAction, useApi } from '@/lib/hooks';

interface S { name: string; slug: string; timezone: string; currency: string; settings: { directoryShowJoinDate: boolean; medicalAnnualLimit: number; overtimeThresholdMinutes: number; payrollWorkingHoursBased: boolean } }
interface WS { id: string; name: string; startTime: string; endTime: string; breakMinutes: number; graceMinutes: number; workingDays: number[]; isDefault: boolean }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Company() {
  const { can, refresh } = useAuth();
  const { data } = useApi<S>('/settings');
  const [v, setV] = useState<S | null>(null);
  useEffect(() => { if (data) setV(data); }, [data]);
  const full = can(P.TENANT_SETTINGS);
  const save = useAction('patch', '/settings', {
    invalidate: ['/settings', '/directory'], success: 'Settings saved', onSuccess: () => refresh(),
    body: () => (full ? { name: v!.name, timezone: v!.timezone, currency: v!.currency, ...v!.settings } : { directoryShowJoinDate: v!.settings.directoryShowJoinDate }),
  });
  if (!v) return null;
  const set = (patch: Partial<S['settings']>) => setV({ ...v, settings: { ...v.settings, ...patch } });
  return (
    <Card>
      <CardHeader title="Company settings" description={`Workspace: ${v.slug}`} />
      <CardBody className="max-w-2xl space-y-5">
        {full && (
          <FormGrid cols={3}>
            <Field label="Company name">{(a) => <Input {...a} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}</Field>
            <Field label="Time zone" hint="IANA name, e.g. Asia/Karachi">{(a) => <Input {...a} value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} />}</Field>
            <Field label="Currency">{(a) => <Input {...a} maxLength={3} value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value.toUpperCase() })} />}</Field>
          </FormGrid>
        )}
        {full && (
          <FormGrid>
            <Field label="Medical allowance limit per year">{(a) => <Input {...a} type="number" value={v.settings.medicalAnnualLimit} onChange={(e) => set({ medicalAnnualLimit: Number(e.target.value) })} />}</Field>
            <Field label="Minimum overtime to count (minutes)">{(a) => <Input {...a} type="number" value={v.settings.overtimeThresholdMinutes} onChange={(e) => set({ overtimeThresholdMinutes: Number(e.target.value) })} />}</Field>
          </FormGrid>
        )}
        <div className="flex flex-col gap-3">
          {full && <Checkbox label="Calculate salaries from actual working hours" checked={v.settings.payrollWorkingHoursBased} onChange={(e) => set({ payrollWorkingHoursBased: e.target.checked })} />}
          <Checkbox label='Show joining month in the directory (e.g. "Since Jan 2026")' checked={v.settings.directoryShowJoinDate} onChange={(e) => set({ directoryShowJoinDate: e.target.checked })} />
        </div>
        <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>Save settings</Button>
      </CardBody>
    </Card>
  );
}

function Schedules() {
  const { data, isLoading } = useApi<WS[]>('/work-schedules');
  const [edit, setEdit] = useState<{ open: boolean; ws?: WS }>({ open: false });
  const form = useZodForm(workScheduleSchema);
  useEffect(() => {
    if (edit.open) form.reset(edit.ws ? { ...edit.ws, startTime: edit.ws.startTime.slice(0, 5), endTime: edit.ws.endTime.slice(0, 5) } : { name: '', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 15, workingDays: [1, 2, 3, 4, 5], isDefault: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);
  const days = (form.watch('workingDays') as number[] | undefined) ?? [];
  const save = useAction('post', '/work-schedules', { invalidate: ['/work-schedules'], success: 'Schedule saved', onSuccess: () => setEdit({ open: false }) });
  const update = useAction('put', () => `/work-schedules/${edit.ws!.id}`, { invalidate: ['/work-schedules'], success: 'Schedule saved', onSuccess: () => setEdit({ open: false }) });
  const num = { valueAsNumber: true };
  return (
    <Card>
      <CardHeader title="Working timelines" description="Used for lateness, overtime, leave day counts and payroll hours." action={<Button size="sm" onClick={() => setEdit({ open: true })}><Plus className="h-3.5 w-3.5" /> Add schedule</Button>} />
      <DataTable loading={isLoading} rows={data} rowKey={(w) => w.id} onRowClick={(w) => setEdit({ open: true, ws: w })} columns={[
        { key: 'n', header: 'Name', cell: (w) => <span className="font-medium">{w.name} {w.isDefault && <Badge tone="primary">default</Badge>}</span> },
        { key: 't', header: 'Hours', cell: (w) => `${w.startTime.slice(0, 5)} – ${w.endTime.slice(0, 5)}` },
        { key: 'b', header: 'Break', cell: (w) => `${w.breakMinutes} min` },
        { key: 'g', header: 'Grace', hideOnMobile: true, cell: (w) => `${w.graceMinutes} min` },
        { key: 'd', header: 'Days', hideOnMobile: true, cell: (w) => w.workingDays.map((d) => DAYS[d]).join(', ') },
      ]} />
      <Dialog open={edit.open} onOpenChange={(o) => setEdit({ open: o, ws: edit.ws })} title={edit.ws ? 'Edit schedule' : 'New schedule'}
        footer={<><Button variant="outline" onClick={() => setEdit({ open: false })}>Cancel</Button><Button loading={save.isPending || update.isPending} onClick={form.handleSubmit((v) => (edit.ws ? update.mutate(v) : save.mutate(v)))}>Save</Button></>}>
        <div className="space-y-4">
          <Field label="Name" required error={fieldError(form, 'name')}>{(a) => <Input {...a} {...form.register('name')} />}</Field>
          <FormGrid>
            <Field label="Start" error={fieldError(form, 'startTime')}>{(a) => <Input {...a} type="time" {...form.register('startTime')} />}</Field>
            <Field label="End" error={fieldError(form, 'endTime')}>{(a) => <Input {...a} type="time" {...form.register('endTime')} />}</Field>
            <Field label="Break (minutes)" error={fieldError(form, 'breakMinutes')}>{(a) => <Input {...a} type="number" {...form.register('breakMinutes', num)} />}</Field>
            <Field label="Late grace (minutes)" error={fieldError(form, 'graceMinutes')}>{(a) => <Input {...a} type="number" {...form.register('graceMinutes', num)} />}</Field>
          </FormGrid>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Working days</legend>
            <div className="flex flex-wrap gap-3">{DAYS.map((d, i) => <Checkbox key={d} label={d} checked={days.includes(i)} onChange={() => form.setValue('workingDays', (days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort()) as never)} />)}</div>
          </fieldset>
          <Checkbox label="Default for everyone without a specific schedule" {...form.register('isDefault')} />
        </div>
      </Dialog>
    </Card>
  );
}

export default function SettingsPage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs tabs={[
        { value: 'company', label: 'Company', hidden: !can(P.TENANT_SETTINGS, P.DIRECTORY_SETTINGS), content: <Company /> },
        { value: 'schedules', label: 'Working hours', hidden: !can(P.ATTENDANCE_MANAGE), content: <Schedules /> },
      ]} />
    </>
  );
}
