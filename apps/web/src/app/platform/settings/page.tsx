'use client';

import { MODULE_INFO, planSchema, testEmailSchema, type Module } from '@hrms/shared';
import { CheckCircle2, Mail, Pencil, Plus, Send, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, KeyValue, PageHeader, Skeleton } from '@/components/ui/display';
import { Checkbox, Field, FormGrid, Input, Textarea } from '@/components/ui/form';
import { Dialog, Tabs, useConfirm } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { fieldError, useZodForm } from '@/lib/form';
import { dateTime, money } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { ModulePicker, NewOwnerDialog, PlatformNav, usePlatformMe, type Plan } from '../shared';

function PlanDialog({ plan, open, onOpenChange }: { plan?: Plan; open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useZodForm(planSchema);
  useEffect(() => {
    if (open) form.reset(plan ? { name: plan.name, description: plan.description ?? undefined, priceMonthly: plan.priceMonthly, currency: plan.currency, modules: plan.modules, maxEmployees: plan.maxEmployees, isActive: plan.isActive } : { name: '', description: undefined, priceMonthly: 0, currency: 'PKR', modules: ['ATTENDANCE', 'LEAVE'], maxEmployees: null, isActive: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan]);
  const done = { invalidate: ['/platform/plans'], success: 'Plan saved', onSuccess: () => onOpenChange(false) };
  const create = useAction('post', '/platform/plans', done);
  const update = useAction('put', () => `/platform/plans/${plan!.id}`, done);
  const modules = (form.watch('modules') ?? []) as Module[];
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" title={plan ? `Edit ${plan.name}` : 'New plan'}
      description="Companies get the modules you tick. Editing a plan doesn't change companies already on it; open a company and choose the plan again to update it."
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={create.isPending || update.isPending} onClick={form.handleSubmit((v) => (plan ? update.mutate(v) : create.mutate(v)))}>Save plan</Button></>}>
      <div className="space-y-4">
        <FormGrid>
          <Field label="Name" required error={fieldError(form, 'name')}>{(a) => <Input {...a} {...form.register('name')} />}</Field>
          <Field label="Monthly price" required error={fieldError(form, 'priceMonthly')}>{(a) => <Input {...a} type="number" min={0} {...form.register('priceMonthly', { valueAsNumber: true })} />}</Field>
          <Field label="Currency" error={fieldError(form, 'currency')}>{(a) => <Input {...a} maxLength={3} {...form.register('currency')} />}</Field>
          <Field label="Employee limit" hint="Leave empty for no limit" error={fieldError(form, 'maxEmployees')}>{(a) => <Input {...a} type="number" min={1} {...form.register('maxEmployees', { setValueAs: (v) => (v === '' || v === null ? null : Number(v)) })} />}</Field>
        </FormGrid>
        <Field label="Description" error={fieldError(form, 'description')}>{(a) => <Textarea {...a} rows={2} {...form.register('description')} />}</Field>
        <div>
          <p className="mb-2 text-sm font-medium">Modules</p>
          <ModulePicker value={modules} onChange={(m) => form.setValue('modules', m, { shouldDirty: true })} />
          {fieldError(form, 'modules') && <p className="mt-1 text-xs text-danger">{fieldError(form, 'modules')}</p>}
        </div>
        <Checkbox label="Active (can be chosen for companies)" {...form.register('isActive')} />
      </div>
    </Dialog>
  );
}

function Plans() {
  const { data, isLoading } = useApi<Plan[]>('/platform/plans');
  const [edit, setEdit] = useState<{ open: boolean; plan?: Plan }>({ open: false });
  const del = useAction<string>('del', (id) => `/platform/plans/${id}`, { invalidate: ['/platform/plans'], success: 'Plan deleted' });
  const { confirm, node } = useConfirm();
  return (
    <Card>
      <CardHeader title="Plans" description="What you sell. Each company is on one plan, or a custom set of modules." action={<Button size="sm" onClick={() => setEdit({ open: true })}><Plus className="h-4 w-4" /> New plan</Button>} />
      <DataTable loading={isLoading} rows={data} rowKey={(p) => p.id} onRowClick={(p) => setEdit({ open: true, plan: p })} empty="No plans yet" columns={[
        { key: 'n', header: 'Plan', cell: (p) => <div><p className="font-medium">{p.name} {!p.isActive && <Badge>inactive</Badge>}</p>{p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}</div> },
        { key: 'p', header: 'Price', cell: (p) => <span className="tabular-nums">{money(p.priceMonthly, p.currency)}<span className="text-muted-foreground">/mo</span></span> },
        { key: 'm', header: 'Modules', cell: (p) => <div className="flex flex-wrap gap-1">{p.modules.map((m) => <Badge key={m} tone="primary">{MODULE_INFO[m].label}</Badge>)}</div> },
        { key: 'e', header: 'Employees', hideOnMobile: true, cell: (p) => p.maxEmployees ?? 'Unlimited' },
        { key: 'c', header: 'Companies', cell: (p) => p.companies },
        { key: 'a', header: <span className="sr-only">Actions</span>, cell: (p) => (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setEdit({ open: true, plan: p })}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label={`Delete ${p.name}`} className="text-danger" onClick={async () => { if (await confirm({ title: `Delete the ${p.name} plan?`, body: p.companies ? `${p.companies} compan${p.companies === 1 ? 'y is' : 'ies are'} on this plan, so it can't be deleted. Deactivate it instead.` : 'This cannot be undone.', danger: true, confirmLabel: 'Delete' })) del.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ) },
      ]} />
      <PlanDialog plan={edit.plan} open={edit.open} onOpenChange={(o) => setEdit({ open: o, plan: edit.plan })} />
      {node}
    </Card>
  );
}

function Owners() {
  const { data } = useApi<{ id: string; name: string; email: string; lastLoginAt: string | null }[]>('/platform/admins');
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader title="Super Admins" description="People who run the whole platform: companies, plans and settings. Only an existing Super Admin can add another." action={<Button size="sm" variant="outline" onClick={() => setOpen(true)}><ShieldCheck className="h-4 w-4" /> Add Super Admin</Button>} />
      <DataTable rows={data} rowKey={(o) => o.id} columns={[
        { key: 'n', header: 'Name', cell: (o) => <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.email}</p></div> },
        { key: 'l', header: 'Last sign-in', cell: (o) => (o.lastLoginAt ? dateTime(o.lastLoginAt) : 'never') },
      ]} />
      <NewOwnerDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function Email({ myEmail }: { myEmail: string }) {
  const { data } = useApi<{ configured: boolean; host: string | null; from: string }>('/platform/email');
  const form = useZodForm(testEmailSchema, { to: myEmail });
  const [result, setResult] = useState<{ delivered: boolean; info: string } | null>(null);
  const test = useAction<{ to: string }, { delivered: boolean; info: string }>('post', '/platform/email/test', { onSuccess: setResult });
  return (
    <Card>
      <CardHeader title="Outgoing email" description="Welcome emails, invitations, password resets and notifications. Set SMTP_URL and MAIL_FROM on the server to change it." />
      <CardBody className="space-y-5">
        {data && (
          <KeyValue items={[
            ['Status', data.configured ? <span key="s" className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> SMTP configured</span> : <span key="s" className="flex items-center gap-1.5 text-warning"><XCircle className="h-4 w-4" /> Not configured – emails are only written to the API log</span>],
            ['Mail server', data.host ?? '—'],
            ['Sender', data.from],
          ]} />
        )}
        <div className="flex flex-wrap items-end gap-3 border-t pt-4">
          <Field label="Send a test email to" className="min-w-64 flex-1" error={fieldError(form, 'to')}>{(a) => <Input {...a} type="email" {...form.register('to')} />}</Field>
          <Button loading={test.isPending} onClick={form.handleSubmit((v) => { setResult(null); test.mutate(v); })}><Send className="h-4 w-4" /> Send test</Button>
        </div>
        {result && (
          <p className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${result.delivered ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
            <Mail className="mt-0.5 h-4 w-4 shrink-0" /> {result.info}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/** General settings for all companies. */
export default function PlatformSettingsPage() {
  const { data: me, isLoading } = usePlatformMe();
  if (isLoading || !me) return <Skeleton className="h-96" />;
  return (
    <>
      <PlatformNav me={me} />
      <PageHeader title="Platform settings" description="Settings that apply to every company." />
      <Tabs tabs={[
        { value: 'plans', label: 'Plans & pricing', content: <Plans /> },
        { value: 'owners', label: 'Super Admins', content: <Owners /> },
        { value: 'email', label: 'Email', content: <Email myEmail={me.email} /> },
      ]} />
    </>
  );
}
