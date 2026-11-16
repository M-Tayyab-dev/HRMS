'use client';

import { PERMISSIONS as P } from '@hrms/shared';
import { CalendarCheck, CalendarDays, CalendarPlus, CalendarRange, Clock, Hourglass, Inbox, Plane, Timer } from 'lucide-react';
import Link from 'next/link';
import { QuickActions, type QuickAction } from '@/components/overview';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, PageHeader, Progress, Skeleton, Stat, StatusBadge } from '@/components/ui/display';
import { useAuth } from '@/lib/auth';
import { date } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface LeaveOverview {
  scope: 'company' | 'team' | 'self';
  pending: number;
  approvedThisMonth: number;
  onLeaveToday: number;
  upcoming: number;
  balances: { leaveTypeId: string; name: string; color: string; available: number; allocated: number; used: number; pending: number }[];
  recent: { id: string; employeeName: string; typeName: string; typeColor: string; startDate: string; endDate: string; status: string; currentStep: string | null }[];
}

const SCOPE: Record<LeaveOverview['scope'], string> = { company: 'Across the company', team: 'You and your team', self: 'Your own leave' };

/** Attendance & leave overview: KPIs, quick actions, balances and the latest requests. */
export default function LeaveOverviewPage() {
  const { can, isTeamLead, hasModule, me } = useAuth();
  const { data, isLoading, error } = useApi<LeaveOverview>('/leave/overview', { fresh: true });
  const approver = can(P.LEAVE_APPROVE_HR) || isTeamLead;

  const actions: QuickAction[] = [
    ...(me?.employee ? [{ href: '/leave', label: 'Apply for leave', description: 'Send a request', icon: CalendarPlus }] : []),
    ...(approver ? [{ href: '/approvals', label: 'Approvals', description: 'Requests waiting for you', icon: Inbox }] : []),
    { href: '/calendar', label: 'Calendar', description: 'Leave, holidays and events', icon: CalendarDays },
    ...(hasModule('ATTENDANCE') ? [{ href: '/attendance', label: 'Attendance', description: 'Check-ins and hours', icon: Clock }, { href: '/overtime', label: 'Overtime', icon: Timer }] : []),
    { href: '/leave', label: 'Leave & holidays', description: 'History, types and holidays', icon: CalendarRange },
  ];

  return (
    <>
      <PageHeader title="Leave overview" description={data ? SCOPE[data.scope] : undefined} />
      {error ? <ErrorState message={error.message} /> : isLoading || !data ? <Skeleton className="h-64" /> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pending requests" icon={Hourglass} tone="warning" value={data.pending} hint="Waiting for approval" />
            <Stat label="Approved this month" icon={CalendarCheck} tone="success" value={data.approvedThisMonth} />
            <Stat label="On leave today" icon={Plane} tone="info" value={data.onLeaveToday} />
            <Stat label="Upcoming (30 days)" icon={CalendarRange} value={data.upcoming} hint="Approved leave starting soon" />
          </div>
          <QuickActions actions={actions} />
          <div className="grid gap-4 lg:grid-cols-3">
            {data.balances.length > 0 && (
              <Card>
                <CardHeader title="My balances" action={<Link className="text-xs text-primary hover:underline" href="/leave">Apply</Link>} />
                <CardBody className="space-y-3">
                  {data.balances.map((b) => (
                    <div key={b.leaveTypeId}>
                      <div className="mb-1 flex justify-between text-sm"><span>{b.name}</span><span className="font-medium tabular-nums">{b.available} <span className="text-muted-foreground">/ {b.allocated}</span></span></div>
                      <Progress value={b.allocated ? (b.available / b.allocated) * 100 : 0} />
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
            <Card className={data.balances.length ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <CardHeader title="Latest requests" action={<Link className="text-xs text-primary hover:underline" href="/leave">All requests</Link>} />
              {data.recent.length ? (
                <ul className="divide-y">
                  {data.recent.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.typeColor }} aria-hidden />
                        <span className="min-w-0"><span className="block truncate font-medium">{r.employeeName}</span><span className="block text-xs text-muted-foreground">{r.typeName} · {date(r.startDate)}{r.endDate !== r.startDate ? ` – ${date(r.endDate)}` : ''}</span></span>
                      </span>
                      <StatusBadge status={r.status} step={r.currentStep} />
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon={CalendarRange} title="No leave requests yet" />}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
