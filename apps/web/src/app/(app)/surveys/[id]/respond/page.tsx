'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/display';
import { Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface Q { id: string; type: 'TEXT' | 'RATING' | 'SINGLE_CHOICE' | 'MULTI_CHOICE'; label: string; options?: string[]; required: boolean }
interface Survey { id: string; title: string; description: string | null; anonymous: boolean; questions: Q[] }

export default function RespondPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: s, isLoading, error } = useApi<Survey>(`/surveys/${id}`);
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorState message={error.message} />;
  if (isLoading || !s) return <Skeleton className="h-96" />;
  if (done) return <Card><EmptyState icon={CheckCircle2} title="Thank you for your feedback!" action={<Link href="/surveys"><Button variant="outline">Back to surveys</Button></Link>} /></Card>;

  const submit = async () => {
    const missing = s.questions.find((q) => q.required && (answers[q.id] === undefined || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !(answers[q.id] as string[]).length)));
    if (missing) return toast.error(`Please answer: ${missing.label}`);
    setBusy(true);
    try {
      await api.post(`/surveys/${id}/responses`, { answers });
      setDone(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={s.title} description={s.description ?? undefined} />
      {s.anonymous && <p className="mb-4"><Badge tone="info">Anonymous: your name is not attached to your answers</Badge></p>}
      <div className="space-y-4">
        {s.questions.map((q, i) => (
          <Card key={q.id}>
            <CardBody>
              <fieldset>
                <legend className="mb-3 text-sm font-medium">{i + 1}. {q.label}{q.required && <span className="text-danger" aria-hidden> *</span>}</legend>
                {q.type === 'RATING' && (
                  <div className="flex gap-2" role="radiogroup" aria-label={q.label}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} role="radio" aria-checked={answers[q.id] === n} onClick={() => setAnswers({ ...answers, [q.id]: n })} className={cn('h-10 w-10 rounded-md border text-sm font-medium', answers[q.id] === n ? 'border-primary bg-primary text-white' : 'hover:bg-muted')}>{n}</button>
                    ))}
                    <span className="ml-2 self-center text-xs text-muted-foreground">1 = poor · 5 = excellent</span>
                  </div>
                )}
                {q.type === 'TEXT' && <Textarea aria-label={q.label} rows={3} value={(answers[q.id] as string) ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />}
                {q.type === 'SINGLE_CHOICE' && q.options?.map((o) => (
                  <label key={o} className="flex items-center gap-2 py-1 text-sm"><input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => setAnswers({ ...answers, [q.id]: o })} className="accent-[var(--primary)]" /> {o}</label>
                ))}
                {q.type === 'MULTI_CHOICE' && q.options?.map((o) => {
                  const cur = (answers[q.id] as string[]) ?? [];
                  return <label key={o} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={cur.includes(o)} onChange={() => setAnswers({ ...answers, [q.id]: cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o] })} className="accent-[var(--primary)]" /> {o}</label>;
                })}
              </fieldset>
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="mt-6 flex justify-end"><Button size="lg" loading={busy} onClick={submit}>Submit answers</Button></div>
    </div>
  );
}
