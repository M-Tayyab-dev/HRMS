'use client';

import { PERMISSIONS as P, QUERY_CATEGORIES, querySchema } from '@hrms/shared';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, StatusBadge } from '@/components/ui/display';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Dialog, Tabs } from '@/components/ui/overlay';
import { DataTable } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { fieldError, useZodForm } from '@/lib/form';
import { humanize, relative } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface Q { id: string; subject: string; category: string; status: string; updatedAt: string; employeeName: string; departmentName: string; assignedToName: string | null }

function List({ scope }: { scope: 'mine' | 'assigned' | 'all' }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useApi<Q[]>(`/queries?scope=${scope}${status ? `&status=${status}` : ''}`);
  return (
    <Card>
      <div className="flex gap-2 border-b p-3">
        <Select className="w-auto" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option>
        </Select>
      </div>
      <DataTable loading={isLoading} rows={data} rowKey={(q) => q.id} onRowClick={(q) => router.push(`/queries/${q.id}`)} empty="No queries" columns={[
        { key: 's', header: 'Subject', cell: (q) => <div><p className="font-medium">{q.subject}</p><p className="text-xs text-muted-foreground">{humanize(q.category)}</p></div> },
        ...(scope !== 'mine' ? [{ key: 'e', header: 'From', cell: (q: Q) => <div><p>{q.employeeName}</p><p className="text-xs text-muted-foreground">{q.departmentName}</p></div> }] : []),
        { key: 'a', header: 'Handled by', hideOnMobile: true, cell: (q) => q.assignedToName ?? 'HR' },
        { key: 'u', header: 'Updated', hideOnMobile: true, cell: (q) => <span className="text-muted-foreground">{relative(q.updatedAt)}</span> },
        { key: 'st', header: 'Status', cell: (q) => <StatusBadge status={q.status} /> },
      ]} />
    </Card>
  );
}

/** F6 – employee queries & support. */
export default function QueriesPage() {
  const { can, isTeamLead, me } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useZodForm(querySchema, { subject: '', category: 'GENERAL', body: '' });
  const create = useAction<unknown, { id: string }>('post', '/queries', { invalidate: ['/queries'], success: 'Query sent to your Team Lead', onSuccess: (r) => { setOpen(false); form.reset(); router.push(`/queries/${r.id}`); } });
  return (
    <>
      <PageHeader title="Queries & support" description="Ask a question or make a request. It goes to your Team Lead automatically." actions={me?.employee && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New query</Button>} />
      <Tabs tabs={[
        { value: 'mine', label: 'My queries', hidden: !me?.employee, content: <List scope="mine" /> },
        { value: 'assigned', label: 'Assigned to me', hidden: !isTeamLead && !can(P.QUERIES_RESPOND), content: <List scope="assigned" /> },
        { value: 'all', label: 'All departments', hidden: !can(P.QUERIES_READ_ALL), content: <List scope="all" /> },
      ]} />
      <Dialog open={open} onOpenChange={setOpen} title="New query" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(v))}>Send</Button></>}>
        <div className="space-y-4">
          <Field label="Subject" required error={fieldError(form, 'subject')}>{(a) => <Input {...a} {...form.register('subject')} />}</Field>
          <Field label="Category">{(a) => <Select {...a} {...form.register('category')}>{QUERY_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}</Select>}</Field>
          <Field label="Details" required error={fieldError(form, 'body')}>{(a) => <Textarea {...a} rows={5} {...form.register('body')} />}</Field>
        </div>
      </Dialog>
    </>
  );
}
