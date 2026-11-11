'use client';

import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/display';
import { DataTable } from '@/components/ui/table';
import { relative } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface Item {
  workflow: string;
  label: string;
  id: string;
  employeeName: string;
  step: string;
  createdAt: string;
  link: string;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const { data, isLoading, error } = useApi<Item[]>('/approvals/inbox');
  return (
    <>
      <PageHeader title="Approvals" description="Everything waiting for your decision across leave, attendance, overtime, KPIs, payroll and more." />
      <Card>
        {!isLoading && !error && !data?.length ? (
          <EmptyState icon={CheckCircle2} title="You're all caught up" description="New requests that need your approval will appear here." />
        ) : (
          <DataTable
            loading={isLoading}
            error={error}
            rows={data}
            rowKey={(r) => `${r.workflow}-${r.id}`}
            onRowClick={(r) => router.push(r.link)}
            columns={[
              { key: 'type', header: 'Request', cell: (r) => <span className="font-medium">{r.label}</span> },
              { key: 'who', header: 'From', cell: (r) => r.employeeName || '—' },
              { key: 'step', header: 'Your step', cell: (r) => <StatusBadge status="PENDING" step={r.step} /> },
              { key: 'when', header: 'Submitted', cell: (r) => <span className="text-muted-foreground">{relative(r.createdAt)}</span>, hideOnMobile: true },
            ]}
          />
        )}
      </Card>
    </>
  );
}
