'use client';

import { RotateCcw } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, LoadingRows, PageHeader } from '@/components/ui/display';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface RolesRes { permissions: string[]; roles: { role: string; label: string; editable: boolean; permissions: string[]; defaults: string[] }[] }

const groupOf = (p: string) => {
  const head = p.split('.')[0]!;
  const map: Record<string, string> = {
    roles: 'Access', users: 'Access', tenant: 'Access', audit: 'Access',
    employees: 'Employees', employee_docs: 'Employees', employment_docs: 'Employees', departments: 'Employees', teams: 'Employees', team_transfer: 'Employees', promotions: 'Employees', resignation: 'Employees', headcount: 'Employees', directory: 'Employees',
    attendance: 'Workforce', attendance_correction: 'Workforce', overtime: 'Workforce', compensation: 'Workforce', leave: 'Workforce', holidays: 'Workforce', calendar: 'Workforce',
    payroll: 'Payroll', loans: 'Payroll', medical: 'Payroll', food_allowance: 'Payroll',
    kpi: 'Performance', incentives: 'Performance',
    policies: 'Compliance', guidelines: 'Compliance', complaints: 'Compliance', queries: 'Compliance', surveys: 'Compliance',
    community: 'Community', announcements: 'Community', reports: 'Reports',
  };
  return map[head] ?? 'Other';
};

/** A1 – role → permission matrix, editable per company. */
export default function RolesPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<RolesRes>('/access/roles');
  const [draft, setDraft] = useState<Record<string, Set<string>>>({});
  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.roles.map((r) => [r.role, new Set(r.permissions)])));
  }, [data]);
  const save = useAction<{ role: string; permissions: string[] }>('put', (v) => `/access/roles/${v.role}`, { invalidate: ['/access/roles'], success: 'Permissions saved', body: (v) => ({ permissions: v.permissions }) });
  const groups = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const p of data?.permissions ?? []) g.set(groupOf(p), [...(g.get(groupOf(p)) ?? []), p]);
    return [...g];
  }, [data]);

  if (isLoading || !data) return <Card><LoadingRows /></Card>;
  const editable = data.roles.filter((r) => r.editable);
  const toggle = (role: string, p: string) => setDraft((d) => { const s = new Set(d[role]); if (s.has(p)) s.delete(p); else s.add(p); return { ...d, [role]: s }; });
  const dirty = (role: string) => { const orig = new Set(data.roles.find((r) => r.role === role)!.permissions); const cur = draft[role] ?? new Set(); return orig.size !== cur.size || [...cur].some((p) => !orig.has(p)); };

  return (
    <>
      <PageHeader title="Roles & permissions" description="Choose what each role can do. Super Admin always has full access. You can only grant permissions you hold yourself." />
      <Card>
        <CardHeader title="Permission matrix" action={<div className="flex flex-wrap gap-2">{editable.map((r) => dirty(r.role) && (
          <Button key={r.role} size="sm" loading={save.isPending} onClick={() => save.mutate({ role: r.role, permissions: [...(draft[r.role] ?? [])] })}>Save {r.label}</Button>
        ))}</div>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Permission</th>
                {editable.map((r) => (
                  <th key={r.role} scope="col" className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase">
                    <div className="flex items-center justify-center gap-1">
                      {r.label}
                      <button className="rounded p-0.5 hover:bg-muted" title="Reset to defaults" aria-label={`Reset ${r.label} to defaults`} onClick={() => setDraft((d) => ({ ...d, [r.role]: new Set(r.defaults) }))}><RotateCcw className="h-3 w-3" /></button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([group, perms]) => (
                <Fragment key={group}>
                  <tr className="bg-muted/30"><th colSpan={editable.length + 1} scope="rowgroup" className="px-4 py-1.5 text-left text-xs font-semibold">{group}</th></tr>
                  {perms.map((p) => (
                    <tr key={p} className="border-b last:border-0">
                      <th scope="row" className="px-4 py-2 text-left font-mono text-xs font-normal">{p}</th>
                      {editable.map((r) => {
                        const on = draft[r.role]?.has(p) ?? false;
                        return (
                          <td key={r.role} className="px-3 py-2 text-center">
                            <input type="checkbox" className={cn('h-4 w-4 accent-[var(--primary)]')} checked={on} disabled={!can(p as never)} onChange={() => toggle(r.role, p)} aria-label={`${r.label}: ${p}`} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
