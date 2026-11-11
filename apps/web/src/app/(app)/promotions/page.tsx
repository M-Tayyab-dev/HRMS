'use client';

import Link from 'next/link';
import { Avatar, Badge, Card, PageHeader } from '@/components/ui/display';
import { DataTable } from '@/components/ui/table';
import { date } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface Row { id: string; employeeId: string; fullName: string; avatarFileId: string | null; designation: string; levelCode: string; levelTitle: string; departmentName: string; changeType: string; startDate: string; notes: string | null }

/** B8 – position changes across the organisation. Promote someone from their profile. */
export default function PromotionsPage() {
  const { data, isLoading, error } = useApi<Row[]>('/promotions');
  return (
    <>
      <PageHeader title="Promotions" description="Recent promotions, transfers and level adjustments. To promote someone, open their profile and choose Promote." />
      <Card>
        <DataTable loading={isLoading} error={error} rows={data} rowKey={(r) => r.id} empty="No promotions recorded yet" columns={[
          { key: 'n', header: 'Employee', cell: (r) => <Link href={`/employees/${r.employeeId}`} className="flex items-center gap-3 hover:underline"><Avatar name={r.fullName} fileId={r.avatarFileId} size="sm" /><span className="font-medium">{r.fullName}</span></Link> },
          { key: 'p', header: 'New position', cell: (r) => <div><p>{r.levelCode} – {r.designation}</p><p className="text-xs text-muted-foreground">{r.departmentName}</p></div> },
          { key: 't', header: 'Type', cell: (r) => <Badge tone={r.changeType === 'PROMOTED' ? 'success' : 'neutral'}>{r.changeType.toLowerCase()}</Badge> },
          { key: 'd', header: 'Effective', cell: (r) => date(r.startDate) },
          { key: 'notes', header: 'Notes', hideOnMobile: true, cell: (r) => <span className="text-muted-foreground">{r.notes ?? '—'}</span> },
        ]} />
      </Card>
    </>
  );
}
