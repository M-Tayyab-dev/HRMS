'use client';

import { MODULE_INFO, MODULES, createCompanySchema, platformAdminSchema, type Module } from '@hrms/shared';
import { Building2, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox, Field, FormGrid, Input, Select } from '@/components/ui/form';
import { Dialog } from '@/components/ui/overlay';
import { api } from '@/lib/api';
import { cn, money } from '@/lib/format';
import { fieldError, useZodForm } from '@/lib/form';
import { useAction, useApi } from '@/lib/hooks';
import { currencyOptions, timeZoneOptions } from '@/lib/locale-options';

export interface PlatformMe { id: string; name: string; email: string }
export interface Plan { id: string; name: string; description: string | null; priceMonthly: number; currency: string; modules: Module[]; maxEmployees: number | null; isActive: boolean; companies: number }
export interface CompanyRow { id: string; name: string; slug: string; status: 'ACTIVE' | 'SUSPENDED'; timezone: string; currency: string; activeEmployees: number; maxEmployees: number | null; modules: Module[]; planId: string | null; planName: string | null; createdAt: string }

/** Signed-in platform owner; sends anyone else to the platform login. */
export function usePlatformMe() {
  const router = useRouter();
  const q = useApi<PlatformMe>('/platform/me');
  useEffect(() => {
    if (q.error) router.replace('/platform/login');
  }, [q.error, router]);
  return q;
}

/** Top navigation of the platform console. */
export function PlatformNav({ me }: { me: PlatformMe }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: '/platform', label: 'Companies', icon: Building2, on: pathname === '/platform' || pathname.startsWith('/platform/companies') },
    { href: '/platform/settings', label: 'Platform settings', icon: Settings, on: pathname.startsWith('/platform/settings') },
  ];
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Platform" className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={l.on ? 'page' : undefined}
            className={cn('flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm', l.on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
            <l.icon className="h-4 w-4" aria-hidden /> {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="hidden sm:inline">{me.name}</span>
        <Button variant="outline" size="sm" onClick={async () => { await api.post('/platform/logout'); router.replace('/platform/login'); }}><LogOut className="h-4 w-4" /> Sign out</Button>
      </div>
    </div>
  );
}

/** Module on/off list used for plans and per-company deals. */
export function ModulePicker({ value, onChange }: { value: Module[]; onChange: (m: Module[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MODULES.map((m) => (
        <label key={m} className={cn('flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors', value.includes(m) ? 'border-primary bg-primary-soft/60' : 'hover:bg-muted/50')}>
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={value.includes(m)} onChange={() => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m])} />
          <span>
            <span className="block text-sm font-medium">{MODULE_INFO[m].label}</span>
            <span className="block text-xs text-muted-foreground">{MODULE_INFO[m].description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export const planLabel = (p: Plan) => `${p.name} – ${money(p.priceMonthly, p.currency)}/month`;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function NewCompanyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { data: plans } = useApi<Plan[]>(open ? '/platform/plans' : null);
  const [setPassword, setSetPassword] = useState(false);
  const blank = { companyName: '', workspace: '', adminName: '', email: '', password: undefined, mustChangePassword: true, planId: undefined, timezone: 'Asia/Karachi', currency: 'PKR' };
  const form = useZodForm(createCompanySchema, blank);
  useEffect(() => {
    if (open) {
      form.reset(blank);
      setSetPassword(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const create = useAction<unknown, { tenantId: string; invited: boolean }>('post', '/platform/companies', {
    invalidate: ['/platform/companies', '/platform/plans'],
    onSuccess: (r) => {
      toast.success(r.invited ? 'Company created. A welcome email with a link to set a password was sent to the Super Admin.' : 'Company created. A welcome email was sent; share the temporary password securely.');
      onOpenChange(false);
      router.push(`/platform/companies/${r.tenantId}`);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New company" description="Creates the workspace with default departments, levels and leave types, and emails its first Super Admin." size="lg"
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(setPassword ? v : { ...v, password: undefined }))}>Create company</Button></>}>
      <div className="space-y-4">
        <FormGrid>
          <Field label="Company name" required error={fieldError(form, 'companyName')}>{(a) => <Input {...a} {...form.register('companyName', { onChange: (e) => { if (!form.getFieldState('workspace').isDirty) form.setValue('workspace', slugify(e.target.value)); } })} />}</Field>
          <Field label="Workspace" required error={fieldError(form, 'workspace')} hint="Used to sign in, e.g. acme">{(a) => <Input {...a} autoCapitalize="none" {...form.register('workspace')} />}</Field>
          <Field label="Super Admin name" required error={fieldError(form, 'adminName')}>{(a) => <Input {...a} {...form.register('adminName')} />}</Field>
          <Field label="Super Admin email" required error={fieldError(form, 'email')} hint="The welcome email goes here">{(a) => <Input {...a} type="email" {...form.register('email')} />}</Field>
          <Field label="Plan" error={fieldError(form, 'planId')} hint="Decides which modules the company gets">{(a) => (
            <Select {...a} {...form.register('planId', { setValueAs: (v) => (v === '' ? undefined : v) })}>
              <option value="">All modules (no plan)</option>
              {plans?.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{planLabel(p)}</option>)}
            </Select>
          )}</Field>
          <Field label="Time zone" error={fieldError(form, 'timezone')}>{(a) => <Combobox {...a} value={form.watch('timezone')} onChange={(tz) => form.setValue('timezone', tz, { shouldDirty: true })} options={timeZoneOptions()} searchPlaceholder="Search city, region or UTC offset…" />}</Field>
          <Field label="Currency" error={fieldError(form, 'currency')}>{(a) => <Combobox {...a} value={form.watch('currency')} onChange={(c) => form.setValue('currency', c, { shouldDirty: true })} options={currencyOptions()} renderValue={(o) => o.value} searchPlaceholder="Search currency…" />}</Field>
        </FormGrid>
        <Checkbox label="Set a temporary password instead of emailing a set-password link" checked={setPassword} onChange={(e) => setSetPassword(e.target.checked)} />
        {setPassword && (
          <Field label="Temporary password" required error={fieldError(form, 'password')} hint="They must change it at first sign-in. It is not included in the email.">{(a) => <Input {...a} type="password" autoComplete="new-password" {...form.register('password')} />}</Field>
        )}
      </div>
    </Dialog>
  );
}

export function NewOwnerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useZodForm(platformAdminSchema, { name: '', email: '', password: '' });
  const add = useAction('post', '/platform/admins', { invalidate: ['/platform/admins'], success: 'Platform owner added', onSuccess: () => { form.reset(); onOpenChange(false); } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add platform owner" description="Platform owners manage every company, plan and platform setting."
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={add.isPending} onClick={form.handleSubmit((v) => add.mutate(v))}>Add owner</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required error={fieldError(form, 'name')}>{(a) => <Input {...a} {...form.register('name')} />}</Field>
        <Field label="Email" required error={fieldError(form, 'email')}>{(a) => <Input {...a} type="email" {...form.register('email')} />}</Field>
        <Field label="Password" required error={fieldError(form, 'password')} hint="12+ characters with upper and lower case letters and a number">{(a) => <Input {...a} type="password" autoComplete="new-password" {...form.register('password')} />}</Field>
      </div>
    </Dialog>
  );
}
