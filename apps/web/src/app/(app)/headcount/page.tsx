'use client';

import { UserMinus, UserPlus, Users, UserX } from 'lucide-react';
import { BarList, Card, CardBody, CardHeader, ErrorState, PageHeader, Skeleton, Stat, StatusBadge } from '@/components/ui/display';
import { DataTable } from '@/components/ui/table';
import { date, monthLabel } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface Headcount {
  total: number;
  active: number;
  inactive: number;
  resigned: number;
  terminated: number;
  newRegistrations: number;
  byDepartment: { departmentId: string; name: string; n: number }[];
  byTeam: { teamId: string; name: string; n: number }[];
  monthly: { month: string; joined: number; left: number }[];
  recentJoiners: { id: string; fullName: string; designation: string; departmentName: string; date: string }[];
  leavers: { id: string; fullName: string; designation: string; departmentName: string; status: string; date: string | null }[];
}

/** B6 – workforce monitoring. */
export default function HeadcountPage() {
  const { data: d, isLoading, error } = useApi<Headcount>('/headcount');
  if (error) return <ErrorState message={error.message} />;
  if (isLoading || !d) return <Skeleton className="h-96" />;
  const maxMonthly = Math.max(1, ...d.monthly.map((m) => Math.max(m.joined, m.left)));
  return (
    <>
      <PageHeader title="Headcount & reports" description="Workforce size, movement and distribution." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active employees" icon={Users} value={d.active} hint={`${d.total} registered in total`} />
        <Stat label="New (last 30 days)" icon={UserPlus} tone="success" value={d.newRegistrations} />
        <Stat label="Inactive" icon={UserX} tone="neutral" value={d.inactive} />
        <Stat label="Resigned / terminated" icon={UserMinus} tone="danger" value={`${d.resigned} / ${d.terminated}`} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Joining and leaving history" description="Last 12 months" />
        <CardBody>
          <div className="flex h-48 items-end gap-2" role="img" aria-label="Monthly joiners and leavers chart">
            {d.monthly.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-40 w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 max-w-4 rounded-t bg-success" style={{ height: `${(m.joined / maxMonthly) * 100}%` }} title={`${m.joined} joined`} />
                  <div className="w-1/2 max-w-4 rounded-t bg-danger/70" style={{ height: `${(m.left / maxMonthly) * 100}%` }} title={`${m.left} left`} />
                </div>
                <span className="text-[10px] text-muted-foreground">{monthLabel(m.month).slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Joined</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-danger/70" /> Left</span>
          </div>
          <table className="sr-only">
            <caption>Monthly joiners and leavers</caption>
            <tbody>{d.monthly.map((m) => <tr key={m.month}><th>{m.month}</th><td>{m.joined} joined</td><td>{m.left} left</td></tr>)}</tbody>
          </table>
        </CardBody>
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="By department" /><CardBody><BarList items={d.byDepartment.map((x) => ({ label: x.name, value: x.n }))} /></CardBody></Card>
        <Card><CardHeader title="By team" /><CardBody>{d.byTeam.length ? <BarList items={d.byTeam.map((x) => ({ label: x.name, value: x.n }))} /> : <p className="text-sm text-muted-foreground">No teams yet.</p>}</CardBody></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent joiners" />
          <DataTable rows={d.recentJoiners} rowKey={(r) => r.id} empty="No joiners" columns={[
            { key: 'n', header: 'Name', cell: (r) => <div><p className="font-medium">{r.fullName}</p><p className="text-xs text-muted-foreground">{r.designation} · {r.departmentName}</p></div> },
            { key: 'd', header: 'Joined', cell: (r) => date(r.date) },
          ]} />
        </Card>
        <Card>
          <CardHeader title="Resigned and terminated" />
          <DataTable rows={d.leavers} rowKey={(r) => r.id} empty="No leavers" columns={[
            { key: 'n', header: 'Name', cell: (r) => <div><p className="font-medium">{r.fullName}</p><p className="text-xs text-muted-foreground">{r.designation} · {r.departmentName}</p></div> },
            { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { key: 'd', header: 'Exit', cell: (r) => date(r.date) },
          ]} />
        </Card>
      </div>
    </>
  );
}
