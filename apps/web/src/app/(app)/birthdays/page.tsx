'use client';

import { Cake } from 'lucide-react';
import { Avatar, Badge, Card, EmptyState, LoadingRows, PageHeader } from '@/components/ui/display';
import { date } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface B { id: string; fullName: string; avatarFileId: string | null; designation: string; departmentName: string; date: string; isToday: boolean }

/** G3 – birthdays, visible company-wide (birth year is never shown). */
export default function BirthdaysPage() {
  const { data, isLoading } = useApi<B[]>('/birthdays');
  const today = data?.filter((b) => b.isToday) ?? [];
  const upcoming = data?.filter((b) => !b.isToday) ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Birthdays" description="Celebrate your colleagues. Birthday wishes are posted to the community automatically." />
      {isLoading ? <Card><LoadingRows /></Card> : !data?.length ? <Card><EmptyState icon={Cake} title="No birthdays in the next 30 days" /></Card> : (
        <div className="space-y-6">
          {today.length > 0 && (
            <section aria-labelledby="today">
              <h2 id="today" className="mb-3 text-sm font-semibold text-muted-foreground">Today 🎉</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {today.map((b) => (
                  <Card key={b.id} className="flex items-center gap-4 border-pink-300 bg-gradient-to-br from-pink-50 to-card p-5 dark:border-pink-900 dark:from-pink-950/40">
                    <Avatar name={b.fullName} fileId={b.avatarFileId} size="xl" />
                    <div><p className="text-lg font-semibold">{b.fullName}</p><p className="text-sm text-muted-foreground">{b.designation} · {b.departmentName}</p><Badge tone="primary" className="mt-2">Happy birthday!</Badge></div>
                  </Card>
                ))}
              </div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming">
              <h2 id="upcoming" className="mb-3 text-sm font-semibold text-muted-foreground">Next 30 days</h2>
              <Card>
                <ul className="divide-y">
                  {upcoming.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={b.fullName} fileId={b.avatarFileId} />
                      <div className="min-w-0 flex-1"><p className="font-medium">{b.fullName}</p><p className="text-xs text-muted-foreground">{b.designation} · {b.departmentName}</p></div>
                      <span className="text-sm text-muted-foreground">{date(b.date, { day: 'numeric', month: 'long' })}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
