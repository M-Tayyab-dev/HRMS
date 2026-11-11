'use client';

import { Download, Receipt } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PayslipView, type Payslip } from '@/components/payslip-view';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, LoadingRows, PageHeader, Skeleton, StatusBadge } from '@/components/ui/display';
import { Dialog } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money, monthLabel } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface Row { id: string; period: string; gross: number; net: number; totalDeductions: number; status: string }

/** D1 – monthly salary slips (web + PDF) and previous payment records. */
export default function PayslipsPage() {
  const { me } = useAuth();
  const currency = me?.tenant.currency ?? 'PKR';
  const { data, isLoading } = useApi<Row[]>('/payroll/me/payslips');
  const [open, setOpen] = useState<string | null>(null);
  const { data: slip } = useApi<Payslip>(open ? `/payroll/payslips/${open}` : null);
  return (
    <>
      <PageHeader title="My salary slips" description="Your salary slips and payment history. Only you and payroll staff can see these." />
      <Card>
        {isLoading ? <LoadingRows /> : !data?.length ? <EmptyState icon={Receipt} title="No salary slips yet" description="Slips appear here once payroll is approved by HR and Operations." /> : (
          <DataTable rows={data} rowKey={(r) => r.id} onRowClick={(r) => setOpen(r.id)} columns={[
            { key: 'p', header: 'Month', cell: (r) => <span className="font-medium">{monthLabel(r.period)}</span> },
            { key: 'g', header: 'Gross', hideOnMobile: true, cell: (r) => <span className="tabular-nums">{money(r.gross, currency)}</span> },
            { key: 'd', header: 'Deductions', hideOnMobile: true, cell: (r) => <span className="tabular-nums">{money(r.totalDeductions, currency)}</span> },
            { key: 'n', header: 'Net pay', cell: (r) => <span className="font-semibold tabular-nums">{money(r.net, currency)}</span> },
            { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { key: 'x', header: <span className="sr-only">Download</span>, cell: (r) => <Button size="icon" variant="ghost" aria-label={`Download ${monthLabel(r.period)} slip`} onClick={(e) => { e.stopPropagation(); downloadFile(`/payroll/payslips/${r.id}/pdf`, `salary-slip-${r.period}.pdf`).catch((err) => toast.error(err.message)); }}><Download className="h-4 w-4" /></Button> },
          ]} />
        )}
      </Card>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} title="Salary slip" size="lg">
        {slip ? <PayslipView slip={slip} currency={currency} /> : <Skeleton className="h-64" />}
      </Dialog>
    </>
  );
}
