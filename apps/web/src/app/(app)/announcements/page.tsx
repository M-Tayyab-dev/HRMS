'use client';

import { PERMISSIONS as P, announcementSchema } from '@hrms/shared';
import { Megaphone, Pin, Plus } from 'lucide-react';
import { useState } from 'react';
import { DepartmentSelect } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, EmptyState, LoadingRows, PageHeader } from '@/components/ui/display';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form';
import { Dialog } from '@/components/ui/overlay';
import { useAuth } from '@/lib/auth';
import { fieldError, useZodForm } from '@/lib/form';
import { dateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface A { id: string; title: string; body: string; pinned: boolean; createdAt: string; departmentName: string | null }

/** G2 – official company announcements (also on the feed and dashboards). */
export default function AnnouncementsPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<A[]>('/announcements?limit=50');
  const [open, setOpen] = useState(false);
  const form = useZodForm(announcementSchema, { title: '', body: '', departmentId: null, pinned: false });
  const publish = useAction('post', '/announcements', { invalidate: ['/announcements', '/community', '/dashboard'], success: 'Announcement published and everyone notified', onSuccess: () => { setOpen(false); form.reset(); } });
  const pin = useAction<{ id: string; pinned: boolean }>('patch', (v) => `/announcements/${v.id}/pin`, { invalidate: ['/announcements'], body: (v) => ({ pinned: v.pinned }) });
  const manage = can(P.ANNOUNCEMENTS_PUBLISH);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Announcements" description="Official news from the company." actions={manage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New announcement</Button>} />
      {isLoading ? <Card><LoadingRows /></Card> : !data?.length ? <Card><EmptyState icon={Megaphone} title="No announcements yet" /></Card> : (
        <div className="space-y-4">
          {data.map((a) => (
            <Card key={a.id} className={a.pinned ? 'border-primary/40' : undefined}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex flex-wrap gap-1.5">{a.pinned && <Badge tone="primary">Pinned</Badge>}{a.departmentName && <Badge>{a.departmentName}</Badge>}</div>
                    <h2 className="font-semibold">{a.title}</h2>
                    <p className="text-xs text-muted-foreground">{dateTime(a.createdAt)}</p>
                  </div>
                  {manage && <Button size="icon" variant="ghost" aria-label={a.pinned ? 'Unpin' : 'Pin'} onClick={() => pin.mutate({ id: a.id, pinned: !a.pinned })}><Pin className={a.pinned ? 'h-4 w-4 fill-current text-primary' : 'h-4 w-4'} /></Button>}
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap">{a.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen} title="New announcement" size="lg" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={publish.isPending} onClick={form.handleSubmit((v) => publish.mutate(v))}>Publish</Button></>}>
        <div className="space-y-4">
          <Field label="Title" required error={fieldError(form, 'title')}>{(a) => <Input {...a} {...form.register('title')} />}</Field>
          <Field label="Message" required error={fieldError(form, 'body')}>{(a) => <Textarea {...a} rows={6} {...form.register('body')} />}</Field>
          <Field label="Audience">{(a) => <DepartmentSelect {...a} includeAll="Whole company" {...form.register('departmentId', { setValueAs: (v) => (v === '' ? null : v) })} />}</Field>
          <Checkbox label="Pin to the top" {...form.register('pinned')} />
        </div>
      </Dialog>
    </div>
  );
}
