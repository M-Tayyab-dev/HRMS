'use client';

import { PAYMENT_METHOD_KINDS, PAYMENT_METHOD_LABELS, paymentMethodSchema } from '@hrms/shared';
import { Ban, CheckCircle2, CreditCard, Pencil, Plus, ReceiptText, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui/display';
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from '@/components/ui/form';
import { Dialog, useConfirm } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { fieldError, useZodForm } from '@/lib/form';
import { date, dateTime, money } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

export type BillingStatus = 'PAID' | 'DUE' | 'UNPAID';
export const BILLING_TONE: Record<BillingStatus, 'success' | 'warning' | 'danger'> = { PAID: 'success', DUE: 'warning', UNPAID: 'danger' };
export const BILLING_LABEL: Record<BillingStatus, string> = { PAID: 'Paid', DUE: 'Payment due', UNPAID: 'Unpaid' };

interface Invoice { id: string; planName: string; cycle: 'MONTHLY' | 'ANNUAL'; amount: number; currency: string; periodStart: string; periodEnd: string; status: 'PENDING' | 'PAID' | 'VOID'; paymentReference: string | null; paymentMethodName: string | null; submittedAt: string | null; paidAt: string | null; note: string | null }

/** Company page: cycle, payment status and invoices, with Mark paid / Mark unpaid. */
export function CompanyBilling({ companyId, cycle, status, paidUntil, isDemo }: { companyId: string; cycle: 'MONTHLY' | 'ANNUAL'; status: BillingStatus; paidUntil: string | null; isDemo: boolean }) {
  const key = `/platform/companies/${companyId}/billing`;
  const inv = ['/platform/companies'];
  const { data: invoices, isLoading } = useApi<Invoice[]>(key);
  const { confirm, node } = useConfirm();
  const setCycle = useAction<'MONTHLY' | 'ANNUAL'>('patch', `/platform/companies/${companyId}`, { invalidate: inv, success: 'Billing cycle changed (applies from the next invoice)', body: (c) => ({ billingCycle: c }) });
  const setDemo = useAction<boolean>('patch', `/platform/companies/${companyId}`, { invalidate: inv, success: (r: unknown) => 'Demo setting saved', body: (d) => ({ isDemo: d }) });
  const create = useAction('post', `/platform/companies/${companyId}/invoices`, { invalidate: [key, ...inv], success: 'Invoice created' });
  const paid = useAction<string>('post', (id) => `/platform/invoices/${id}/paid`, { invalidate: [key, ...inv], success: 'Marked paid. The workspace is unlocked.', body: () => ({}) });
  const unpaid = useAction<string | undefined>('post', `/platform/companies/${companyId}/unpaid`, { invalidate: [key, ...inv], success: 'Marked unpaid. The workspace is locked to Billing.', body: (invoiceId) => ({ invoiceId }) });
  const voidInv = useAction<string>('post', (id) => `/platform/invoices/${id}/void`, { invalidate: [key], success: 'Invoice cancelled', body: () => ({}) });

  return (
    <Card className="mt-6">
      <CardHeader title="Billing" description="Payments are confirmed by hand: when the money arrives, Mark paid. Unpaid companies can only open their Billing page."
        action={<Badge tone={BILLING_TONE[status]}>{BILLING_LABEL[status]}{paidUntil ? ` · until ${date(paidUntil)}` : ''}</Badge>} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Billing cycle" className="w-48">{(a) => (
            <Select {...a} value={cycle} onChange={(e) => setCycle.mutate(e.target.value as 'MONTHLY' | 'ANNUAL')}>
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Yearly</option>
            </Select>
          )}</Field>
          <Button variant="outline" loading={create.isPending} onClick={() => create.mutate(undefined)}><Plus className="h-4 w-4" /> New invoice</Button>
          {status !== 'UNPAID' && (
            <Button variant="outline" className="text-danger" loading={unpaid.isPending} onClick={async () => { if (await confirm({ title: 'Mark this company unpaid?', body: 'Their workspace is paused (only Billing works) until you mark an invoice paid.', danger: true, confirmLabel: 'Mark unpaid' })) unpaid.mutate(undefined); }}>
              <Ban className="h-4 w-4" /> Mark unpaid
            </Button>
          )}
          <span className="ml-auto"><Checkbox label="Public demo company (read-only)" checked={isDemo} onChange={(e) => setDemo.mutate(e.target.checked)} /></span>
        </div>
        <DataTable loading={isLoading} rows={invoices} rowKey={(i) => i.id} empty="No invoices yet. Use New invoice to bill the current period." columns={[
          { key: 'p', header: 'Period', cell: (i) => <div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-muted-foreground" />{date(i.periodStart)} – {date(i.periodEnd)}</div> },
          { key: 'a', header: 'Amount', cell: (i) => <div><p className="tabular-nums">{money(i.amount, i.currency)}</p><p className="text-xs text-muted-foreground">{i.planName} · {i.cycle === 'ANNUAL' ? 'yearly' : 'monthly'}</p></div> },
          { key: 'r', header: 'Paid with', cell: (i) => (i.paymentReference ? <div className="text-xs"><p className="font-medium">{i.paymentMethodName ?? '—'}</p><p className="text-muted-foreground">Ref {i.paymentReference}{i.submittedAt ? ` · ${dateTime(i.submittedAt)}` : ''}</p></div> : <span className="text-xs text-muted-foreground">—</span>) },
          { key: 's', header: 'Status', cell: (i) => <Badge tone={i.status === 'PAID' ? 'success' : i.status === 'VOID' ? 'neutral' : i.submittedAt ? 'info' : 'warning'}>{i.status === 'PAID' ? 'Paid' : i.status === 'VOID' ? 'Cancelled' : i.submittedAt ? 'Check payment' : 'Unpaid'}</Badge> },
          { key: 'x', header: <span className="sr-only">Actions</span>, cell: (i) => (
            <div className="flex justify-end gap-1">
              {i.status === 'PENDING' && <Button size="sm" loading={paid.isPending && paid.variables === i.id} onClick={() => paid.mutate(i.id)}><CheckCircle2 className="h-4 w-4" /> Mark paid</Button>}
              {i.status === 'PAID' && <Button size="sm" variant="outline" onClick={async () => { if (await confirm({ title: 'Mark this invoice unpaid?', body: 'Use this if the payment bounced or was refunded. The workspace is paused until it is paid.', danger: true, confirmLabel: 'Mark unpaid' })) unpaid.mutate(i.id); }}>Mark unpaid</Button>}
              {i.status === 'PENDING' && <Button size="icon" variant="ghost" aria-label="Cancel invoice" onClick={async () => { if (await confirm({ title: 'Cancel this invoice?', danger: true, confirmLabel: 'Cancel invoice' })) voidInv.mutate(i.id); }}><XCircle className="h-4 w-4 text-danger" /></Button>}
            </div>
          ) },
        ]} />
      </CardBody>
      {node}
    </Card>
  );
}

interface Method { id: string; name: string; kind: (typeof PAYMENT_METHOD_KINDS)[number]; instructions: string; isActive: boolean }

/** Platform settings → Payment methods: how companies can pay, with the details they see. */
export function PaymentMethods() {
  const { data, isLoading } = useApi<Method[]>('/platform/payment-methods');
  const [edit, setEdit] = useState<{ open: boolean; m?: Method }>({ open: false });
  const form = useZodForm(paymentMethodSchema);
  useEffect(() => {
    if (edit.open) form.reset(edit.m ? { name: edit.m.name, kind: edit.m.kind, instructions: edit.m.instructions, isActive: edit.m.isActive } : { name: '', kind: 'BANK_TRANSFER', instructions: '', isActive: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);
  const done = { invalidate: ['/platform/payment-methods'], success: 'Payment method saved', onSuccess: () => setEdit({ open: false }) };
  const create = useAction('post', '/platform/payment-methods', done);
  const update = useAction('put', () => `/platform/payment-methods/${edit.m!.id}`, done);
  const del = useAction<string>('del', (id) => `/platform/payment-methods/${id}`, { invalidate: ['/platform/payment-methods'], success: 'Payment method removed' });
  const { confirm, node } = useConfirm();
  return (
    <Card>
      <CardHeader title="Payment methods" description="Shown to companies when they pay an invoice. There's no card gateway yet: companies pay with one of these and you confirm with Mark paid."
        action={<Button size="sm" onClick={() => setEdit({ open: true })}><Plus className="h-4 w-4" /> Add method</Button>} />
      {!isLoading && !data?.length ? (
        <EmptyState icon={CreditCard} title="No payment methods yet" description="Add your bank account or mobile wallet so companies know how to pay." />
      ) : (
        <DataTable loading={isLoading} rows={data} rowKey={(m) => m.id} onRowClick={(m) => setEdit({ open: true, m })} columns={[
          { key: 'n', header: 'Method', cell: (m) => <div><p className="font-medium">{m.name} {!m.isActive && <Badge>hidden</Badge>}</p><p className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[m.kind]}</p></div> },
          { key: 'i', header: 'Details shown to companies', cell: (m) => <p className="line-clamp-2 max-w-md text-xs whitespace-pre-line text-muted-foreground">{m.instructions}</p> },
          { key: 'a', header: <span className="sr-only">Actions</span>, cell: (m) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" aria-label={`Edit ${m.name}`} onClick={() => setEdit({ open: true, m })}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={`Remove ${m.name}`} className="text-danger" onClick={async () => { if (await confirm({ title: `Remove ${m.name}?`, danger: true, confirmLabel: 'Remove' })) del.mutate(m.id); }}><XCircle className="h-4 w-4" /></Button>
            </div>
          ) },
        ]} />
      )}
      <Dialog open={edit.open} onOpenChange={(o) => setEdit({ open: o, m: edit.m })} title={edit.m ? `Edit ${edit.m.name}` : 'Add payment method'}
        footer={<><Button variant="outline" onClick={() => setEdit({ open: false })}>Cancel</Button><Button loading={create.isPending || update.isPending} onClick={form.handleSubmit((v) => (edit.m ? update.mutate(v) : create.mutate(v)))}>Save</Button></>}>
        <div className="space-y-4">
          <FormGrid>
            <Field label="Name" required error={fieldError(form, 'name')}>{(a) => <Input {...a} placeholder="e.g. Meezan Bank" {...form.register('name')} />}</Field>
            <Field label="Type" error={fieldError(form, 'kind')}>{(a) => <Select {...a} {...form.register('kind')}>{PAYMENT_METHOD_KINDS.map((k) => <option key={k} value={k}>{PAYMENT_METHOD_LABELS[k]}</option>)}</Select>}</Field>
          </FormGrid>
          <Field label="Payment details" required hint="Account title, account number / IBAN, wallet number… exactly as companies should use them." error={fieldError(form, 'instructions')}>
            {(a) => <Textarea {...a} rows={5} placeholder={'Account title: Your Company Pvt Ltd\nIBAN: PK00 XXXX 0000 0000 0000 0000\nBranch: Gulberg, Lahore'} {...form.register('instructions')} />}
          </Field>
          <Checkbox label="Show to companies" {...form.register('isActive')} />
        </div>
      </Dialog>
      {node}
    </Card>
  );
}

interface Lead { id: string; email: string; name: string | null; company: string | null; phone: string | null; source: 'DEMO' | 'SIGNUP'; createdAt: string }

/** Marketing: who tried the demo or signed up from the website. */
export function Leads() {
  const { data, isLoading } = useApi<Lead[]>('/platform/leads');
  const [filter, setFilter] = useState<'' | 'DEMO' | 'SIGNUP'>('');
  const rows = (data ?? []).filter((l) => !filter || l.source === filter);
  const csv = () => {
    const lines = [['Date', 'Source', 'Name', 'Email', 'Company', 'Phone'], ...rows.map((l) => [l.createdAt, l.source, l.name ?? '', l.email, l.company ?? '', l.phone ?? ''])];
    const blob = new Blob([lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hrms-leads.csv';
    a.click();
  };
  return (
    <Card>
      <CardHeader title="Leads" description="People who tried the demo or signed up on the website."
        action={<div className="flex gap-2"><Select aria-label="Source" className="w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="">All</option><option value="DEMO">Demo</option><option value="SIGNUP">Sign-up</option></Select><Button size="sm" variant="outline" disabled={!rows.length} onClick={csv}>Export CSV</Button></div>} />
      <DataTable loading={isLoading} rows={rows} rowKey={(l) => l.id} empty="No leads yet" columns={[
        { key: 'n', header: 'Name', cell: (l) => <div><p className="font-medium">{l.name ?? '—'}</p><p className="text-xs text-muted-foreground">{l.email}</p></div> },
        { key: 'c', header: 'Company', cell: (l) => l.company ?? '—' },
        { key: 'p', header: 'Phone', hideOnMobile: true, cell: (l) => l.phone ?? '—' },
        { key: 's', header: 'Source', cell: (l) => <Badge tone={l.source === 'SIGNUP' ? 'success' : 'info'}>{l.source === 'SIGNUP' ? 'Signed up' : 'Tried demo'}</Badge> },
        { key: 'd', header: 'When', hideOnMobile: true, cell: (l) => dateTime(l.createdAt) },
      ]} />
    </Card>
  );
}
