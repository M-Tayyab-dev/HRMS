'use client';

import Link from 'next/link';
import { DecisionButtons } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, StatusBadge } from '@/components/ui/display';
import { DataTable } from '@/components/ui/table';
import { date } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface R { id: string; employeeId: string; employeeName: string; designation: string; departmentName: string; reason: string; requestedLastWorkingDate: string; approvedLastWorkingDate: string | null; status: string; currentStep: string | null; createdAt: string; canDecide: boolean }

/** B4 – resignations (Team Lead review → HR approval). */
export default function ResignationsPage() {
  const { data, isLoading, error } = useApi<R[]>('/resignations');
  return (
    <>
      <PageHeader title="Resignations" description="Team Leads review resignations from their team; HR gives final approval." actions={<Link href="/profile?tab=resignation"><Button variant="outline">My resignation</Button></Link>} />
      <Card>
        <DataTable loading={isLoading} error={error} rows={data} rowKey={(r) => r.id} empty="No resignations" columns={[
          { key: 'e', header: 'Employee', cell: (r) => <div><p className="font-medium">{r.employeeName}</p><p className="text-xs text-muted-foreground">{r.designation} · {r.departmentName}</p></div> },
          { key: 'r', header: 'Reason', hideOnMobile: true, cell: (r) => <p className="line-clamp-2 max-w-xs text-sm text-muted-foreground">{r.reason}</p> },
          { key: 'd', header: 'Last day', cell: (r) => date(r.approvedLastWorkingDate ?? r.requestedLastWorkingDate) },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} step={r.currentStep} /> },
          { key: 'a', header: '', cell: (r) => (r.canDecide ? <DecisionButtons path={`/resignations/${r.id}/decision`} invalidate={['/resignations']} /> : null) },
        ]} />
      </Card>
    </>
  );
}
