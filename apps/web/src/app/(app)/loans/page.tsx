'use client';

import { PERMISSIONS as P, loanSchema } from '@hrms/shared';
import { HandCoins, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmployeeSelect } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, Progress, StatusBadge } from '@/components/ui/display';
import { Field, FormGrid, Input, Textarea } from '@/components/ui/form';
import { Dialog } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { fieldError, useZodForm } from '@/lib/form';
import { date, money, monthLabel, todayLocal } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface Loan { id: string; employeeId: string; fullName: string; principal: number; installment: number; startPeriod: string; reason: string | null; status: string; repaid: number; outstanding: number; createdAt: string }
interface Repayment { id: string; amount: number; paidOn: string; source: string; note: string | null }

/** D2 – loan records, repayments and outstanding balances. */
export default function LoansPage() {
  const { can, me } = useAuth();
  const currency = me?.tenant.currency ?? 'PKR';
  const manage = can(P.LOANS_MANAGE);
  const { data, isLoading } = useApi<Loan[]>('/payroll/loans');
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Loan | null>(null);
  const { data: reps } = useApi<Repayment[]>(detail ? `/payroll/loans/${detail.id}/repayments` : null);
  const [pay, setPay] = useState({ amount: 0, paidOn: todayLocal(), note: '' });
  const form = useZodForm(loanSchema, { startPeriod: todayLocal().slice(0, 7) } as never);
  const create = useAction('post', '/payroll/loans', { invalidate: ['/payroll/loans'], success: 'Loan recorded. Instalments are deducted in payroll automatically.', onSuccess: () => { setOpen(false); form.reset(); } });
  const repay = useAction('post', () => `/payroll/loans/${detail!.id}/repayments`, { invalidate: ['/payroll/loans'], success: 'Repayment recorded', body: () => pay, onSuccess: () => setPay({ amount: 0, paidOn: todayLocal(), note: '' }) });
  const num = { setValueAs: (v: string) => (v === '' ? undefined : Number(v)) };
  return (
    <>
      <PageHeader title="Loans" description={manage ? 'Employee loans. Monthly instalments are deducted in payroll.' : 'Your loans and repayments.'} actions={manage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Record loan</Button>} />
      <Card>
        <DataTable loading={isLoading} rows={data} rowKey={(l) => l.id} onRowClick={setDetail} empty="No loans" columns={[
          ...(manage ? [{ key: 'e', header: 'Employee', cell: (l: Loan) => <span className="font-medium">{l.fullName}</span> }] : []),
          { key: 'p', header: 'Amount', cell: (l) => <span className="tabular-nums">{money(l.principal, currency)}</span> },
          { key: 'i', header: 'Instalment', hideOnMobile: true, cell: (l) => <span className="tabular-nums">{money(l.installment, currency)} / month</span> },
          { key: 'r', header: 'Repaid', cell: (l) => <div className="w-36"><Progress value={(l.repaid / l.principal) * 100} /><p className="mt-1 text-xs text-muted-foreground">{money(l.outstanding, currency)} outstanding</p></div> },
          { key: 'f', header: 'From', hideOnMobile: true, cell: (l) => monthLabel(l.startPeriod) },
          { key: 's', header: 'Status', cell: (l) => <StatusBadge status={l.status} /> },
        ]} />
      </Card>
      <Dialog open={open} onOpenChange={setOpen} title="Record a loan" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(v))}>Save</Button></>}>
        <div className="space-y-4">
          <Field label="Employee" required error={fieldError(form, 'employeeId')}>{(a) => <EmployeeSelect {...a} {...form.register('employeeId')} />}</Field>
          <FormGrid cols={3}>
            <Field label="Loan amount" required error={fieldError(form, 'principal')}>{(a) => <Input {...a} type="number" {...form.register('principal', num)} />}</Field>
            <Field label="Monthly instalment" required error={fieldError(form, 'installment')}>{(a) => <Input {...a} type="number" {...form.register('installment', num)} />}</Field>
            <Field label="First deduction" required error={fieldError(form, 'startPeriod')}>{(a) => <Input {...a} type="month" {...form.register('startPeriod')} />}</Field>
          </FormGrid>
          <Field label="Reason">{(a) => <Textarea {...a} rows={2} {...form.register('reason')} />}</Field>
        </div>
      </Dialog>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title={detail ? `Loan · ${money(detail.principal, currency)}` : ''} description={detail ? `${money(detail.outstanding, currency)} outstanding` : ''} size="lg">
        <div className="space-y-5">
          <ul className="divide-y rounded-md border">
            {!reps?.length && <li className="p-3 text-sm text-muted-foreground">No repayments yet.</li>}
            {reps?.map((r) => <li key={r.id} className="flex justify-between p-3 text-sm"><span>{date(r.paidOn)} · {r.source === 'PAYROLL' ? 'Payroll deduction' : 'Manual'}{r.note ? ` · ${r.note}` : ''}</span><span className="tabular-nums">{money(r.amount, currency)}</span></li>)}
          </ul>
          {manage && detail?.status === 'ACTIVE' && (
            <div className="rounded-md border p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium"><HandCoins className="h-4 w-4" /> Record a manual repayment</p>
              <FormGrid cols={3}>
                <Field label="Amount">{(a) => <Input {...a} type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} />}</Field>
                <Field label="Paid on">{(a) => <Input {...a} type="date" value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} />}</Field>
                <Field label="Note">{(a) => <Input {...a} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />}</Field>
              </FormGrid>
              <Button className="mt-3" size="sm" disabled={pay.amount <= 0} loading={repay.isPending} onClick={() => repay.mutate(undefined)}>Save repayment</Button>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
