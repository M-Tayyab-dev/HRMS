'use client';

import { createCompanySchema, platformAdminSchema } from '@hrms/shared';
import { Building2, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardHeader, PageHeader, Skeleton, Stat } from '@/components/ui/display';
import { Checkbox, Field, FormGrid, Input } from '@/components/ui/form';
import { Dialog } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { fieldError, useZodForm } from '@/lib/form';
import { date, dateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface Me { id: string; name: string; email: string }
interface Company { id: string; name: string; slug: string; status: 'ACTIVE' | 'SUSPENDED'; timezone: string; currency: string; activeEmployees: number; createdAt: string }
interface Owner { id: string; name: string; email: string; lastLoginAt: string | null; createdAt: string }

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function NewCompanyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [setPassword, setSetPassword] = useState(false);
  const blank = { companyName: '', workspace: '', adminName: '', email: '', password: undefined, mustChangePassword: true, timezone: 'Asia/Karachi', currency: 'PKR' };
  const form = useZodForm(createCompanySchema, blank);
  useEffect(() => {
    if (open) {
      form.reset(blank);
      setSetPassword(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const create = useAction<unknown, { invited: boolean }>('post', '/platform/companies', {
    invalidate: ['/platform/companies'],
    onSuccess: (r) => {
      toast.success(r.invited ? 'Company created. The Super Admin was emailed an invite to set a password.' : 'Company created. Share the temporary password securely.');
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New company" description="Creates the workspace with default departments, levels and leave types, and its first Super Admin."
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(setPassword ? v : { ...v, password: undefined }))}>Create company</Button></>}>
      <div className="space-y-4">
        <FormGrid>
          <Field label="Company name" required error={fieldError(form, 'companyName')}>{(a) => <Input {...a} {...form.register('companyName', { onChange: (e) => { if (!form.getFieldState('workspace').isDirty) form.setValue('workspace', slugify(e.target.value)); } })} />}</Field>
          <Field label="Workspace" required error={fieldError(form, 'workspace')} hint="Used to sign in, e.g. acme">{(a) => <Input {...a} autoCapitalize="none" {...form.register('workspace')} />}</Field>
          <Field label="Super Admin name" required error={fieldError(form, 'adminName')}>{(a) => <Input {...a} {...form.register('adminName')} />}</Field>
          <Field label="Super Admin email" required error={fieldError(form, 'email')}>{(a) => <Input {...a} type="email" {...form.register('email')} />}</Field>
          <Field label="Time zone" error={fieldError(form, 'timezone')}>{(a) => <Input {...a} {...form.register('timezone')} />}</Field>
          <Field label="Currency" error={fieldError(form, 'currency')}>{(a) => <Input {...a} maxLength={3} {...form.register('currency')} />}</Field>
        </FormGrid>
        <Checkbox label="Set a temporary password instead of emailing an invite" checked={setPassword} onChange={(e) => setSetPassword(e.target.checked)} />
        {setPassword && (
          <Field label="Temporary password" required error={fieldError(form, 'password')} hint="They must change it at first sign-in.">{(a) => <Input {...a} type="password" autoComplete="new-password" {...form.register('password')} />}</Field>
        )}
      </div>
    </Dialog>
  );
}

function NewOwnerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useZodForm(platformAdminSchema, { name: '', email: '', password: '' });
  const add = useAction('post', '/platform/admins', { invalidate: ['/platform/admins'], success: 'Platform owner added', onSuccess: () => { form.reset(); onOpenChange(false); } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add platform owner" description="Platform owners can create and suspend companies and add other owners."
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={add.isPending} onClick={form.handleSubmit((v) => add.mutate(v))}>Add owner</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required error={fieldError(form, 'name')}>{(a) => <Input {...a} {...form.register('name')} />}</Field>
        <Field label="Email" required error={fieldError(form, 'email')}>{(a) => <Input {...a} type="email" {...form.register('email')} />}</Field>
        <Field label="Password" required error={fieldError(form, 'password')} hint="12+ characters with upper and lower case letters and a number">{(a) => <Input {...a} type="password" autoComplete="new-password" {...form.register('password')} />}</Field>
      </div>
    </Dialog>
  );
}

export default function PlatformPage() {
  const router = useRouter();
  const { data: me, error, isLoading } = useApi<Me>('/platform/me');
  const { data: companies, isLoading: cl } = useApi<Company[]>(me ? '/platform/companies' : null);
  const { data: owners } = useApi<Owner[]>(me ? '/platform/admins' : null);
  const [newCompany, setNewCompany] = useState(false);
  const [newOwner, setNewOwner] = useState(false);
  const setStatus = useAction<{ id: string; status: Company['status'] }>('patch', (v) => `/platform/companies/${v.id}`, { invalidate: ['/platform/companies'], success: 'Company updated', body: (v) => ({ status: v.status }) });

  useEffect(() => {
    if (error) router.replace('/platform/login');
  }, [error, router]);
  if (isLoading || !me) return <Skeleton className="h-96" />;

  const active = companies?.filter((c) => c.status === 'ACTIVE').length ?? 0;
  return (
    <>
      <PageHeader
        title="Companies"
        description={`Signed in as ${me.name} (${me.email})`}
        actions={<>
          <Button onClick={() => setNewCompany(true)}><Plus className="h-4 w-4" /> New company</Button>
          <Button variant="outline" onClick={async () => { await api.post('/platform/logout'); router.replace('/platform/login'); }}><LogOut className="h-4 w-4" /> Sign out</Button>
        </>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Companies" icon={Building2} value={companies?.length ?? 0} />
        <Stat label="Active" tone="success" value={active} />
        <Stat label="Employees (active)" value={companies?.reduce((a, c) => a + c.activeEmployees, 0) ?? 0} />
      </div>
      <Card className="mb-6">
        <DataTable loading={cl} rows={companies} rowKey={(c) => c.id} empty="No companies yet" emptyDescription="Create the first client company." columns={[
          { key: 'n', header: 'Company', cell: (c) => <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">workspace: {c.slug}</p></div> },
          { key: 'e', header: 'Active employees', cell: (c) => c.activeEmployees },
          { key: 'r', header: 'Region', cell: (c) => `${c.timezone} · ${c.currency}` },
          { key: 'd', header: 'Created', cell: (c) => date(c.createdAt) },
          { key: 's', header: 'Status', cell: (c) => <Badge tone={c.status === 'ACTIVE' ? 'success' : 'danger'}>{c.status.toLowerCase()}</Badge> },
          { key: 'a', header: '', cell: (c) => (c.status === 'ACTIVE'
            ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => setStatus.mutate({ id: c.id, status: 'SUSPENDED' })}>Suspend</Button>
            : <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: c.id, status: 'ACTIVE' })}>Reactivate</Button>) },
        ]} />
      </Card>
      <Card>
        <CardHeader title="Platform owners" description="Only an existing owner can add another." action={<Button size="sm" variant="outline" onClick={() => setNewOwner(true)}><ShieldCheck className="h-4 w-4" /> Add owner</Button>} />
        <DataTable rows={owners} rowKey={(o) => o.id} columns={[
          { key: 'n', header: 'Name', cell: (o) => <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.email}</p></div> },
          { key: 'l', header: 'Last sign-in', cell: (o) => (o.lastLoginAt ? dateTime(o.lastLoginAt) : 'never') },
        ]} />
      </Card>
      <NewCompanyDialog open={newCompany} onOpenChange={setNewCompany} />
      <NewOwnerDialog open={newOwner} onOpenChange={setNewOwner} />
    </>
  );
}
