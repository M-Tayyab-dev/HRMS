'use client';

import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, LoadingRows, PageHeader } from '@/components/ui/display';
import { cn, dateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface N {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data, isLoading } = useApi<N[]>('/notifications?limit=100');
  const read = useAction<string>('post', (id) => `/notifications/${id}/read`, { invalidate: ['/notifications'] });
  const readAll = useAction('post', '/notifications/read-all', { invalidate: ['/notifications'], success: 'All marked as read' });
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Approvals, decisions and updates that concern you."
        actions={
          <Button variant="outline" onClick={() => readAll.mutate(undefined)} loading={readAll.isPending}>
            Mark all read
          </Button>
        }
      />
      <Card>
        {isLoading ? (
          <LoadingRows />
        ) : !data?.length ? (
          <EmptyState icon={Bell} title="No notifications" />
        ) : (
          <ul className="divide-y">
            {data.map((n) => (
              <li key={n.id}>
                <button
                  className="flex w-full gap-3 px-5 py-3 text-left hover:bg-muted/50"
                  onClick={() => {
                    if (!n.readAt) read.mutate(n.id);
                    if (n.link) router.push(n.link);
                  }}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-border' : 'bg-primary')} aria-label={n.readAt ? 'Read' : 'Unread'} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', !n.readAt && 'font-medium')}>{n.title}</span>
                    {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{dateTime(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
