'use client';

import { QUERY_STATUSES } from '@hrms/shared';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, Card, CardBody, ErrorState, PageHeader, Skeleton, StatusBadge } from '@/components/ui/display';
import { Select, Textarea } from '@/components/ui/form';
import { useAuth } from '@/lib/auth';
import { cn, dateTime, humanize } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface Detail {
  id: string; subject: string; category: string; body: string; status: string; createdAt: string; employeeId: string; employeeName: string; canRespond: boolean;
  messages: { id: string; body: string; createdAt: string; authorUserId: string; authorName: string | null; authorEmail: string }[];
}

export default function QueryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useAuth();
  const key = `/queries/${id}`;
  const { data: q, isLoading, error } = useApi<Detail>(key);
  const [msg, setMsg] = useState('');
  const reply = useAction('post', `${key}/messages`, { invalidate: ['/queries'], body: () => ({ body: msg }), onSuccess: () => setMsg('') });
  const status = useAction<string>('patch', `${key}/status`, { invalidate: ['/queries'], success: 'Status updated', body: (s) => ({ status: s }) });
  if (error) return <ErrorState message={error.message} />;
  if (isLoading || !q) return <Skeleton className="h-96" />;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/queries" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Queries</Link>
      <PageHeader title={q.subject} description={`${humanize(q.category)} · from ${q.employeeName} · ${dateTime(q.createdAt)}`} actions={q.canRespond ? (
        <Select aria-label="Status" className="w-auto" value={q.status} onChange={(e) => status.mutate(e.target.value)}>{QUERY_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select>
      ) : <StatusBadge status={q.status} />} />
      <Card className="mb-4"><CardBody><p className="text-sm whitespace-pre-wrap">{q.body}</p></CardBody></Card>
      <ol className="space-y-3" aria-label="Conversation">
        {q.messages.map((m) => {
          const mine = m.authorUserId === me?.user.id;
          return (
            <li key={m.id} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
              <Avatar name={m.authorName ?? m.authorEmail} size="sm" />
              <div className={cn('max-w-[80%] rounded-lg px-3 py-2 text-sm', mine ? 'bg-primary text-primary-foreground' : 'bg-card border')}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn('mt-1 text-[11px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{m.authorName ?? m.authorEmail} · {dateTime(m.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <Card className="mt-4">
        <CardBody className="flex gap-2">
          <Textarea aria-label="Reply" rows={2} placeholder="Write a reply…" value={msg} onChange={(e) => setMsg(e.target.value)} className="min-h-0" />
          <Button className="self-end" disabled={!msg.trim()} loading={reply.isPending} onClick={() => reply.mutate(undefined)} aria-label="Send reply"><Send className="h-4 w-4" /></Button>
        </CardBody>
      </Card>
    </div>
  );
}
