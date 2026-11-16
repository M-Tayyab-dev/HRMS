'use client';

import { PERMISSIONS as P, type Paginated } from '@hrms/shared';
import { Building2, Contact, Network, TrendingUp, UserMinus, UserPlus, UserRound, Users, UsersRound, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useDirectory } from '@/components/domain';
import { QuickActions, type QuickAction } from '@/components/overview';
import { Bars } from '@/components/ui/charts';
import { BarList, Card, CardBody, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, Stat } from '@/components/ui/display';
import { useAuth } from '@/lib/auth';
import { date, monthLabel, todayLocal } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { EmployeeDetail } from '../../profile/page';

interface Headcount {
  total: number;
  active: number;
  newRegistrations: number;
  byDepartment: { departmentId: string; name: string; n: number }[];
  monthly: { month: string; joined: number; left: number }[];
  recentJoiners: { id: string; fullName: string; designation: string; departmentName: string; date: string }[];
}

/**
 * Employees overview for staff without access to employee records: only what everyone may see
 * (the company directory and their own profile).
 */
function StaffEmployeesOverview() {
  const { me } = useAuth();
  const { data: people, isLoading, error } = useDirectory();
  const myDept = me?.employee?.departmentName;
  const stats = useMemo(() => {
    const rows = people ?? [];
    const byDept = new Map<string, number>();
    for (const p of rows) byDept.set(p.departmentName, (byDept.get(p.departmentName) ?? 0) + 1);
    const mine = rows.find((p) => p.id === me?.employee?.id);
    return {
      total: rows.length,
      departments: byDept.size,
      byDepartment: [...byDept.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
      sameDept: rows.filter((p) => p.departmentName === myDept && p.id !== me?.employee?.id),
      manager: mine?.reportingManagerName ?? null,
    };
  }, [people, me, myDept]);

  return (
    <>
      <PageHeader title="Employees overview" description="Your colleagues across the company." />
      {error ? <ErrorState message={error.message} /> : isLoading ? <Skeleton className="h-64" /> : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="People in the company" icon={Users} value={stats.total} hint="Active employees" />
            <Stat label="Departments" icon={Building2} tone="warning" value={stats.departments} />
            <Stat label={`In ${myDept ?? 'my department'}`} icon={UsersRound} tone="info" value={stats.sameDept.length + (myDept ? 1 : 0)} hint="Including you" />
            <Stat label="Reports to" icon={UserCheck} tone="success" value={<span className="text-base">{stats.manager ?? '—'}</span>} />
          </div>
          <QuickActions actions={[
            { href: '/directory', label: 'Directory', description: 'Find people and contacts', icon: Contact },
            { href: '/org-chart', label: 'Org chart', description: 'Who reports to whom', icon: Network },
            { href: '/profile', label: 'My profile', description: 'Details, documents, career', icon: UserRound },
            { href: '/resignations', label: 'Resignation', description: 'Submit or track yours', icon: UserMinus },
          ]} />
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="People by department" />
              <CardBody>{stats.byDepartment.length ? <BarList items={stats.byDepartment.map((d) => ({ label: d.name, value: d.n }))} /> : <p className="text-sm text-muted-foreground">No departments yet.</p>}</CardBody>
            </Card>
            <Card>
              <CardHeader title={`My department${myDept ? ` · ${myDept}` : ''}`} action={<Link className="text-xs text-primary hover:underline" href="/directory">Directory</Link>} />
              {stats.sameDept.length ? (
                <ul className="divide-y">
                  {stats.sameDept.slice(0, 8).map((p) => (
                    <li key={p.id} className="px-5 py-2.5 text-sm"><span className="block truncate font-medium">{p.fullName}</span><span className="block truncate text-xs text-muted-foreground">{p.designation}</span></li>
                  ))}
                </ul>
              ) : <EmptyState icon={Users} title="No colleagues listed yet" />}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

/** Employees module overview: KPIs first, then quick actions, then charts and recent records. */
export default function EmployeesOverviewPage() {
  const { can } = useAuth();
  // Everyone gets an overview; people without access to employee records see the directory-based one.
  if (!can(P.EMPLOYEES_READ_ALL) && !can(P.EMPLOYEES_READ_TEAM) && !can(P.HEADCOUNT_READ)) return <StaffEmployeesOverview />;
  return <RecordsEmployeesOverview />;
}

function RecordsEmployeesOverview() {
  const { can } = useAuth();
  const orgWide = can(P.HEADCOUNT_READ);
  // Org-wide numbers for HR / Operations; Team Leads get the same view of the people they can see.
  const hc = useApi<Headcount>(orgWide ? '/headcount' : null);
  const team = useApi<Paginated<EmployeeDetail>>(!orgWide ? '/employees?pageSize=200' : null);
  const since = useMemo(() => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), []);

  const data = useMemo<Headcount | null>(() => {
    if (orgWide) return hc.data ?? null;
    const rows = team.data?.items;
    if (!rows) return null;
    const active = rows.filter((r) => r.employmentStatus === 'ACTIVE');
    const byDept = new Map<string, { departmentId: string; name: string; n: number }>();
    for (const r of active) {
      const d = byDept.get(r.departmentId) ?? { departmentId: r.departmentId, name: r.departmentName, n: 0 };
      d.n++;
      byDept.set(r.departmentId, d);
    }
    return {
      total: rows.length,
      active: active.length,
      newRegistrations: rows.filter((r) => r.joiningDate >= since).length,
      byDepartment: [...byDept.values()],
      monthly: [],
      recentJoiners: [...rows].sort((a, b) => b.joiningDate.localeCompare(a.joiningDate)).slice(0, 8).map((r) => ({ id: r.id, fullName: r.fullName, designation: r.designation, departmentName: r.departmentName, date: r.joiningDate })),
    };
  }, [orgWide, hc.data, team.data, since]);

  const error = hc.error ?? team.error;
  const actions: QuickAction[] = [
    ...(can(P.EMPLOYEES_MANAGE) ? [{ href: '/employees?add=1', label: 'Add employee', description: 'Profile and login account', icon: UserPlus }] : []),
    { href: '/directory', label: 'Directory', description: 'Find people and contacts', icon: Contact },
    { href: '/employees', label: 'Employee records', description: 'Profiles, documents, history', icon: Users },
    { href: '/org-chart', label: 'Org chart', description: 'Who reports to whom', icon: Network },
    ...(can(P.HEADCOUNT_READ) ? [{ href: '/headcount', label: 'Headcount & reports', icon: TrendingUp }] : []),
    ...(can(P.DEPARTMENTS_MANAGE) ? [{ href: '/departments', label: 'Departments & levels', icon: Building2 }] : []),
    ...(can(P.TEAMS_MANAGE) || can(P.TEAMS_MANAGE_OWN) ? [{ href: '/teams', label: 'Teams', icon: UsersRound }] : []),
  ];

  return (
    <>
      <PageHeader title="Employees overview" description={orgWide ? 'Your whole organisation at a glance.' : 'The people you can see: your team and yourself.'} />
      {error ? <ErrorState message={error.message} /> : !data ? <Skeleton className="h-64" /> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total employees" icon={Users} value={data.total} hint="Including former employees" />
            <Stat label="Active" icon={UserCheck} tone="success" value={data.active} />
            <Stat label="New joiners" icon={UserPlus} tone="info" value={data.newRegistrations} hint="Joined in the last 30 days" />
            <Stat label="Departments" icon={Building2} tone="warning" value={data.byDepartment.filter((d) => d.n > 0).length} hint="With active employees" />
          </div>
          <QuickActions actions={actions} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Active employees by department" />
              <CardBody>{data.byDepartment.length ? <BarList items={data.byDepartment.map((d) => ({ label: d.name, value: d.n }))} /> : <p className="text-sm text-muted-foreground">No departments yet.</p>}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Recent joiners" action={<Link className="text-xs text-primary hover:underline" href="/employees">All records</Link>} />
              {data.recentJoiners.length ? (
                <ul className="divide-y">
                  {data.recentJoiners.slice(0, 8).map((j) => (
                    <li key={j.id}>
                      <Link href={`/employees/${j.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted/50">
                        <span className="min-w-0"><span className="block truncate font-medium">{j.fullName}</span><span className="block truncate text-xs text-muted-foreground">{j.designation} · {j.departmentName}</span></span>
                        <span className={j.date > todayLocal() ? 'shrink-0 text-xs text-primary' : 'shrink-0 text-xs text-muted-foreground'}>{date(j.date)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon={Users} title="No employees yet" />}
            </Card>
          </div>
          {data.monthly.length > 0 && (
            <Card>
              <CardHeader title="Joiners per month" description="Last 12 months" />
              <CardBody><Bars items={data.monthly.map((m) => ({ label: monthLabel(m.month).slice(0, 3), value: m.joined, title: `${monthLabel(m.month)}: +${m.joined} joined · −${m.left} left` }))} /></CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
