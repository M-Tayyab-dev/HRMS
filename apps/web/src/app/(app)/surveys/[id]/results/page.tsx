'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { BarList, Card, CardBody, CardHeader, ErrorState, PageHeader, Skeleton, Stat } from '@/components/ui/display';
import { useApi } from '@/lib/hooks';

interface QR { id: string; type: string; label: string; count: number; average?: number | null; distribution?: number[]; options?: { option: string; count: number }[]; answers?: { text: string; by: string | null }[] }
interface Res { survey: { title: string; anonymous: boolean }; responses: number; audience: number; questions: QR[] }

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useApi<Res>(`/surveys/${id}/results`);
  if (error) return <ErrorState message={error.message} />;
  if (isLoading || !data) return <Skeleton className="h-96" />;
  return (
    <>
      <Link href="/surveys" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Surveys</Link>
      <PageHeader title={data.survey.title} description={data.survey.anonymous ? 'Anonymous survey: respondents are not identified.' : undefined} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Responses" value={data.responses} />
        <Stat label="Audience" value={data.audience} />
        <Stat label="Response rate" tone="success" value={`${data.audience ? Math.round((data.responses / data.audience) * 100) : 0}%`} />
      </div>
      <div className="space-y-4">
        {data.questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader title={`${i + 1}. ${q.label}`} description={`${q.count} answers`} />
            <CardBody>
              {q.type === 'RATING' && (
                <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
                  <div><p className="text-4xl font-semibold">{q.average ?? '—'}</p><p className="text-sm text-muted-foreground">average out of 5</p></div>
                  <BarList items={(q.distribution ?? []).map((n, k) => ({ label: `${k + 1} ★`, value: n })).reverse()} />
                </div>
              )}
              {q.options && <BarList items={q.options.map((o) => ({ label: o.option, value: o.count }))} />}
              {q.answers && (
                <ul className="space-y-2">
                  {!q.answers.length && <li className="text-sm text-muted-foreground">No answers.</li>}
                  {q.answers.map((a, k) => <li key={k} className="rounded-md bg-muted px-3 py-2 text-sm">{a.text}{a.by && <span className="block text-xs text-muted-foreground">— {a.by}</span>}</li>)}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
