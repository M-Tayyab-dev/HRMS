'use client';

import { PERMISSIONS as P, holidaySchema, leaveRequestSchema } from '@hrms/shared';
import { CalendarPlus, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { DecisionButtons, DepartmentSelect, EmployeeSelect } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, PageHeader, Progress, StatusBadge } from '@/components/ui/display';
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from '@/components/ui/form';
import { Dialog, Tabs, useConfirm } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { fieldError, useZodForm } from '@/lib/form';
import { date, todayLocal } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface Balance { leaveTypeId: string; code: string; name: string; color: string; allocated: number; used: number; pending: number; available: number; derivedFromOvertime: boolean }
interface LeaveType { id: string; code: string; name: string; annualAllowance: number; isPaid: boolean; derivedFromOvertime: boolean; color: string; isActive: boolean }
interface Req { id: string; employeeId: string; employeeName: string; typeName: string; typeColor: string; startDate: string; endDate: string; halfDay: boolean; days: number; reason: string; status: string; currentStep: string | null; cancellationStatus: string | null; cancellationReason: string | null; createdAt: string; canDecide: boolean; canDecideCancellation: boolean }
interface Holiday { id: string; name: string; date: string; type: string; departmentName: string | null }

function ApplyDialog({ open, onOpenChange, types }: { open: boolean; onOpenChange: (o: boolean) => void; types: LeaveType[] }) {
  const form = useZodForm(leaveRequestSchema, { startDate: todayLocal(), endDate: todayLocal(), halfDay: false, reason: '' } as never);
  const apply = useAction('post', '/leave/requests', { invalidate: ['/leave', '/calendar', '/attendance'], success: 'Leave request sent to your Team Lead', onSuccess: () => { onOpenChange(false); form.reset(); } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Apply for leave" description="Your Team Lead reviews it first, then HR gives final approval."
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={apply.isPending} onClick={form.handleSubmit((v) => apply.mutate(v))}>Submit request</Button></>}>
      <div className="space-y-4">
        <Field label="Leave type" required error={fieldError(form, 'leaveTypeId')}>
          {(a) => <Select {...a} {...form.register('leaveTypeId')}><option value="">Select…</option>{types.filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
        </Field>
        <FormGrid>
          <Field label="From" required error={fieldError(form, 'startDate')}>{(a) => <Input {...a} type="date" {...form.register('startDate')} />}</Field>
          <Field label="To" required error={fieldError(form, 'endDate')}>{(a) => <Input {...a} type="date" {...form.register('endDate')} />}</Field>
        </FormGrid>
        <Checkbox label="Half day" {...form.register('halfDay')} />
        {fieldError(form, 'halfDay') && <p className="text-xs text-danger">{fieldError(form, 'halfDay')}</p>}
        <Field label="Reason" required error={fieldError(form, 'reason')}>{(a) => <Textarea {...a} rows={3} {...form.register('reason')} />}</Field>
        <p className="text-xs text-muted-foreground">Weekends and public holidays aren't counted.</p>
      </div>
    </Dialog>
  );
}

function CancelDialog({ req, onClose }: { req: Req | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const cancel = useAction<{ reason: string }>('post', () => `/leave/requests/${req!.id}/cancel`, { invalidate: ['/leave', '/calendar'], success: req?.status === 'PENDING' ? 'Request withdrawn' : 'Cancellation sent to HR', onSuccess: () => { onClose(); setReason(''); } });
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()} title={req?.status === 'PENDING' ? 'Withdraw request' : 'Request cancellation'} description={req?.status === 'APPROVED' ? 'HR is emailed and will review your reason.' : undefined} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Keep leave</Button><Button variant="danger" disabled={reason.trim().length < 5} loading={cancel.isPending} onClick={() => cancel.mutate({ reason })}>Cancel leave</Button></>}>
      <Field label="Reason" required>{(a) => <Textarea {...a} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
    </Dialog>
  );
}

function Mine({ types }: { types: LeaveType[] }) {
  const { data: balances } = useApi<Balance[]>('/leave/balances');
  const { data: reqs, isLoading } = useApi<Req[]>('/leave/requests?mine=true');
  const [open, setOpen] = useState(false);
  const [cancel, setCancel] = useState<Req | null>(null);
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><CalendarPlus className="h-4 w-4" /> Apply for leave</Button></div>
      <div className="grid gap-4 sm:grid-cols-3">
        {balances?.map((b) => (
          <Card key={b.leaveTypeId} className="p-4">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">{b.name}</p><span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} aria-hidden /></div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{b.available}<span className="text-sm font-normal text-muted-foreground"> / {b.allocated} days</span></p>
            <Progress className="mt-2" value={b.allocated ? (b.available / b.allocated) * 100 : 0} />
            <p className="mt-2 text-xs text-muted-foreground">{b.used} used · {b.pending} pending{b.derivedFromOvertime ? ' · earned from overtime' : ''}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="My leave history" />
        <DataTable loading={isLoading} rows={reqs} rowKey={(r) => r.id} empty="No leave requests yet" columns={[
          { key: 't', header: 'Type', cell: (r) => <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: r.typeColor }} aria-hidden />{r.typeName}</span> },
          { key: 'd', header: 'Dates', cell: (r) => `${date(r.startDate, { day: 'numeric', month: 'short' })}${r.endDate !== r.startDate ? ` – ${date(r.endDate, { day: 'numeric', month: 'short' })}` : ''}` },
          { key: 'n', header: 'Days', cell: (r) => r.days },
          { key: 's', header: 'Status', cell: (r) => <div className="flex flex-col gap-1"><StatusBadge status={r.status} step={r.currentStep} />{r.cancellationStatus === 'REQUESTED' && <Badge tone="warning">cancellation requested</Badge>}</div> },
          { key: 'a', header: '', cell: (r) => (r.status === 'PENDING' || (r.status === 'APPROVED' && r.cancellationStatus !== 'REQUESTED') ? <Button size="sm" variant="ghost" onClick={() => setCancel(r)}>Cancel</Button> : null) },
        ]} />
      </Card>
      <ApplyDialog open={open} onOpenChange={setOpen} types={types} />
      <CancelDialog req={cancel} onClose={() => setCancel(null)} />
    </div>
  );
}

function Approvals() {
  const { data, isLoading } = useApi<Req[]>('/leave/requests');
  const pendingCancel = data?.filter((r) => r.canDecideCancellation) ?? [];
  return (
    <div className="space-y-6">
      {pendingCancel.length > 0 && (
        <Card>
          <CardHeader title="Cancellation requests" description="Approved leave the employee wants to cancel." />
          <DataTable rows={pendingCancel} rowKey={(r) => r.id} columns={[
            { key: 'e', header: 'Employee', cell: (r) => <span className="font-medium">{r.employeeName}</span> },
            { key: 'd', header: 'Dates', cell: (r) => `${date(r.startDate)} – ${date(r.endDate)}` },
            { key: 'r', header: 'Reason', cell: (r) => <span className="text-muted-foreground">{r.cancellationReason}</span> },
            { key: 'a', header: '', cell: (r) => <DecisionButtons path={`/leave/requests/${r.id}/cancellation-decision`} invalidate={['/leave', '/calendar']} /> },
          ]} />
        </Card>
      )}
      <Card>
        <DataTable loading={isLoading} rows={data} rowKey={(r) => r.id} empty="No leave requests" columns={[
          { key: 'e', header: 'Employee', cell: (r) => <span className="font-medium">{r.employeeName}</span> },
          { key: 't', header: 'Type', cell: (r) => r.typeName },
          { key: 'd', header: 'Dates', cell: (r) => <span className="whitespace-nowrap">{date(r.startDate, { day: 'numeric', month: 'short' })} – {date(r.endDate, { day: 'numeric', month: 'short' })} · {r.days}d</span> },
          { key: 'r', header: 'Reason', hideOnMobile: true, cell: (r) => <span className="line-clamp-2 text-muted-foreground">{r.reason}</span> },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} step={r.currentStep} /> },
          { key: 'a', header: '', cell: (r) => (r.canDecide ? <DecisionButtons path={`/leave/requests/${r.id}/decision`} invalidate={['/leave', '/calendar']} /> : null) },
        ]} />
      </Card>
    </div>
  );
}

function Holidays() {
  const { can } = useAuth();
  const year = new Date().getFullYear();
  const { data, isLoading } = useApi<Holiday[]>(`/holidays?year=${year}`);
  const form = useZodForm(holidaySchema, { name: '', date: todayLocal(), type: 'PUBLIC', departmentId: null });
  const [open, setOpen] = useState(false);
  const add = useAction('post', '/holidays', { invalidate: ['/holidays', '/calendar'], success: 'Holiday added', onSuccess: () => { setOpen(false); form.reset(); } });
  const del = useAction<string>('del', (id) => `/holidays/${id}`, { invalidate: ['/holidays', '/calendar'], success: 'Holiday removed' });
  const { confirm, node } = useConfirm();
  const manage = can(P.HOLIDAYS_MANAGE);
  return (
    <Card>
      <CardHeader title={`Holidays ${year}`} description="Shown on everyone's calendar." action={manage && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add holiday</Button>} />
      <DataTable loading={isLoading} rows={data} rowKey={(h) => h.id} empty="No holidays added" columns={[
        { key: 'd', header: 'Date', cell: (h) => date(h.date, { weekday: 'short', day: 'numeric', month: 'long' }) },
        { key: 'n', header: 'Holiday', cell: (h) => <span className="font-medium">{h.name}</span> },
        { key: 't', header: 'Type', cell: (h) => <Badge tone={h.type === 'PUBLIC' ? 'primary' : 'info'}>{h.type.toLowerCase()}</Badge> },
        { key: 's', header: 'Applies to', hideOnMobile: true, cell: (h) => h.departmentName ?? 'Everyone' },
        ...(manage ? [{ key: 'x', header: '', cell: (h: Holiday) => <Button size="icon" variant="ghost" aria-label={`Remove ${h.name}`} onClick={async () => { if (await confirm({ title: `Remove ${h.name}?`, danger: true, confirmLabel: 'Remove' })) del.mutate(h.id); }}><Trash2 className="h-4 w-4 text-danger" /></Button> }] : []),
      ]} />
      <Dialog open={open} onOpenChange={setOpen} title="Add holiday" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={add.isPending} onClick={form.handleSubmit((v) => add.mutate(v))}>Add</Button></>}>
        <div className="space-y-4">
          <Field label="Name" required error={fieldError(form, 'name')}>{(a) => <Input {...a} {...form.register('name')} />}</Field>
          <FormGrid>
            <Field label="Date" required error={fieldError(form, 'date')}>{(a) => <Input {...a} type="date" {...form.register('date')} />}</Field>
            <Field label="Type">{(a) => <Select {...a} {...form.register('type')}><option value="PUBLIC">Public holiday</option><option value="COMPANY">Company holiday</option></Select>}</Field>
          </FormGrid>
          <Field label="Department" hint="Leave empty for company-wide">{(a) => <DepartmentSelect {...a} includeAll="Everyone" {...form.register('departmentId', { setValueAs: (v) => (v === '' ? null : v) })} />}</Field>
        </div>
      </Dialog>
      {node}
    </Card>
  );
}

function Policy({ types }: { types: LeaveType[] }) {
  const [alloc, setAlloc] = useState({ employeeId: '', leaveTypeId: '', year: new Date().getFullYear(), days: 1, reason: '' });
  const save = useAction('post', '/leave/allocations', { invalidate: ['/leave'], success: 'Balance adjusted', onSuccess: () => setAlloc((a) => ({ ...a, days: 1, reason: '' })) });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Leave types" description="Annual entitlement per employee." />
        <DataTable rows={types} rowKey={(t) => t.id} columns={[
          { key: 'n', header: 'Type', cell: (t) => <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} aria-hidden />{t.name}</span> },
          { key: 'a', header: 'Allowance', cell: (t) => (t.derivedFromOvertime ? 'From approved overtime' : `${t.annualAllowance} days / year`) },
          { key: 'p', header: 'Paid', cell: (t) => (t.isPaid ? 'Yes' : 'No') },
        ]} />
      </Card>
      <Card>
        <CardHeader title="Adjust an employee's balance" description="Add (or subtract with a negative number) days for one year." />
        <CardBody className="space-y-4">
          <Field label="Employee">{(a) => <EmployeeSelect {...a} value={alloc.employeeId} onChange={(e) => setAlloc({ ...alloc, employeeId: e.target.value })} />}</Field>
          <FormGrid cols={3}>
            <Field label="Leave type">{(a) => <Select {...a} value={alloc.leaveTypeId} onChange={(e) => setAlloc({ ...alloc, leaveTypeId: e.target.value })}><option value="">Select…</option>{types.filter((t) => !t.derivedFromOvertime).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
            <Field label="Year">{(a) => <Input {...a} type="number" value={alloc.year} onChange={(e) => setAlloc({ ...alloc, year: Number(e.target.value) })} />}</Field>
            <Field label="Days">{(a) => <Input {...a} type="number" step={0.5} value={alloc.days} onChange={(e) => setAlloc({ ...alloc, days: Number(e.target.value) })} />}</Field>
          </FormGrid>
          <Field label="Reason">{(a) => <Input {...a} value={alloc.reason} onChange={(e) => setAlloc({ ...alloc, reason: e.target.value })} />}</Field>
          <Button disabled={!alloc.employeeId || !alloc.leaveTypeId || alloc.reason.length < 3} loading={save.isPending} onClick={() => save.mutate(alloc)}>Save adjustment</Button>
        </CardBody>
      </Card>
    </div>
  );
}

function LeaveInner() {
  const { can, me } = useAuth();
  const params = useSearchParams();
  const { data: types } = useApi<LeaveType[]>('/leave/types');
  return (
    <>
      <PageHeader title="Leave & holidays" description="Casual 14 days, sick 7 days, plus compensation leave from approved overtime." />
      <Tabs defaultValue={params.get('tab') ?? (me?.employee ? 'mine' : 'approvals')} tabs={[
        { value: 'mine', label: 'My leave', hidden: !me?.employee, content: <Mine types={types ?? []} /> },
        { value: 'approvals', label: 'Approvals', hidden: !can(P.LEAVE_APPROVE_TL, P.LEAVE_APPROVE_HR), content: <Approvals /> },
        { value: 'holidays', label: 'Holidays', content: <Holidays /> },
        { value: 'policy', label: 'Leave policy', hidden: !can(P.LEAVE_MANAGE), content: <Policy types={types ?? []} /> },
      ]} />
    </>
  );
}

export default function LeavePage() {
  return <Suspense><LeaveInner /></Suspense>;
}
