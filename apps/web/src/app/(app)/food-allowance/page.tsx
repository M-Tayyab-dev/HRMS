'use client';

import { Utensils } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, LoadingRows, PageHeader } from '@/components/ui/display';
import { Checkbox, Field, Input } from '@/components/ui/form';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface Row { departmentId: string; departmentName: string; enabled: boolean; rule: { dailyAmount: number; minWorkedMinutes: number; excludeWorkFromHome: boolean; excludeEarlyLeave: boolean; isActive: boolean } | null }

function RuleCard({ row, currency }: { row: Row; currency: string }) {
  const [v, setV] = useState({ dailyAmount: 300, minHours: 8, excludeWorkFromHome: true, excludeEarlyLeave: true, isActive: false });
  useEffect(() => {
    setV({
      dailyAmount: row.rule?.dailyAmount ?? 300,
      minHours: (row.rule?.minWorkedMinutes ?? 480) / 60,
      excludeWorkFromHome: row.rule?.excludeWorkFromHome ?? true,
      excludeEarlyLeave: row.rule?.excludeEarlyLeave ?? true,
      isActive: row.enabled && (row.rule?.isActive ?? false),
    });
  }, [row]);
  const save = useAction('put', '/payroll/food-rules', { invalidate: ['/payroll/food-rules', '/departments'], success: `${row.departmentName} rule saved`, body: () => ({ departmentId: row.departmentId, dailyAmount: v.dailyAmount, minWorkedMinutes: Math.round(v.minHours * 60), excludeWorkFromHome: v.excludeWorkFromHome, excludeEarlyLeave: v.excludeEarlyLeave, isActive: v.isActive }) });
  return (
    <Card>
      <CardHeader title={row.departmentName} action={<Badge tone={v.isActive ? 'success' : 'neutral'}>{v.isActive ? 'Enabled' : 'Off'}</Badge>} description={v.isActive ? `${money(v.dailyAmount, currency)} per day after ${v.minHours}h of work` : 'No food allowance'} />
      <CardBody className="space-y-4">
        <Checkbox label="Enable food allowance for this department" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount per day">{(a) => <Input {...a} type="number" min={0} value={v.dailyAmount} disabled={!v.isActive} onChange={(e) => setV({ ...v, dailyAmount: Number(e.target.value) })} />}</Field>
          <Field label="Required hours">{(a) => <Input {...a} type="number" min={0} step={0.5} value={v.minHours} disabled={!v.isActive} onChange={(e) => setV({ ...v, minHours: Number(e.target.value) })} />}</Field>
        </div>
        <div className="flex flex-col gap-2">
          <Checkbox label="Not eligible when working from home" checked={v.excludeWorkFromHome} disabled={!v.isActive} onChange={(e) => setV({ ...v, excludeWorkFromHome: e.target.checked })} />
          <Checkbox label="Not eligible when leaving early" checked={v.excludeEarlyLeave} disabled={!v.isActive} onChange={(e) => setV({ ...v, excludeEarlyLeave: e.target.checked })} />
        </div>
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button>
      </CardBody>
    </Card>
  );
}

/** D4 – food allowance rules per department (HR & Operations). */
export default function FoodAllowancePage() {
  const { me } = useAuth();
  const { data, isLoading } = useApi<Row[]>('/payroll/food-rules');
  return (
    <>
      <PageHeader title="Food allowance" description="Enable per department. Employees earn it on days they complete the required hours on-site; it's added to payroll automatically." />
      {isLoading ? <Card><LoadingRows /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((r) => <RuleCard key={r.departmentId} row={r} currency={me?.tenant.currency ?? 'PKR'} />)}
        </div>
      )}
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Utensils className="h-4 w-4" aria-hidden /> Mark work-from-home days under Attendance → Devices & import.</p>
    </>
  );
}
