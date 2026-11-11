'use client';

import { DOC_CATEGORY_LABELS, EMPLOYMENT_DOC_CATEGORIES, ONBOARDING_DOC_CATEGORIES, PERMISSIONS as P, type DocCategory } from '@hrms/shared';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, monthLabel, money } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Badge, Card, CardBody, CardHeader, EmptyState, LoadingRows } from './ui/display';
import { Field, Input, Select } from './ui/form';
import { Dialog, useConfirm } from './ui/overlay';

export interface Doc {
  id: string;
  category: DocCategory;
  title: string | null;
  source: 'EMPLOYEE' | 'HR';
  fileName: string;
  size: number;
  createdAt: string;
}

/** B2/B3 documents list with upload (self or HR) and download. */
export function DocumentsPanel({ employeeId, self }: { employeeId: string; self: boolean }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const key = `/employees/${employeeId}/documents`;
  const { data, isLoading } = useApi<Doc[]>(key);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DocCategory>(self ? 'CNIC_FRONT' : 'OFFER_LETTER');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, node } = useConfirm();
  const remove = useAction<string>('del', (id) => `/documents/${id}`, { invalidate: [key], success: 'Document removed' });

  const hrDocs = can(P.EMPLOYMENT_DOCS_MANAGE);
  const hrOnboarding = can(P.EMPLOYEE_DOCS_MANAGE);
  const options = [
    ...(self || hrOnboarding ? ONBOARDING_DOC_CATEGORIES : []),
    ...(!self && hrDocs ? EMPLOYMENT_DOC_CATEGORIES : []),
  ] as DocCategory[];
  const uploaded = new Set(data?.map((d) => d.category));

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error('Choose a file');
    const fd = new FormData();
    fd.set('file', file);
    fd.set('category', category);
    if (title) fd.set('title', title);
    setBusy(true);
    try {
      await api.post(self ? '/me/documents' : key, fd);
      toast.success('Document uploaded');
      setOpen(false);
      setTitle('');
      qc.invalidateQueries({ queryKey: [key] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const groups: [string, Doc[]][] = [
    ['Onboarding documents', data?.filter((d) => (ONBOARDING_DOC_CATEGORIES as readonly string[]).includes(d.category)) ?? []],
    ['Employment documents', data?.filter((d) => (EMPLOYMENT_DOC_CATEGORIES as readonly string[]).includes(d.category)) ?? []],
  ];

  return (
    <Card>
      <CardHeader
        title="Documents"
        description={self ? 'Personal documents can be uploaded once. Contact HR to change a submitted document.' : 'Visible only to the employee and authorised HR staff.'}
        action={
          options.length > 0 && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
          )
        }
      />
      {isLoading ? (
        <LoadingRows rows={3} />
      ) : !data?.length ? (
        <EmptyState icon={FileText} title="No documents yet" />
      ) : (
        <CardBody className="space-y-5">
          {groups.map(([label, docs]) =>
            docs.length ? (
              <div key={label}>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</h3>
                <ul className="divide-y rounded-md border">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.title || DOC_CATEGORY_LABELS[d.category]}</p>
                        <p className="text-xs text-muted-foreground">
                          {DOC_CATEGORY_LABELS[d.category]} · {date(d.createdAt)} · {(d.size / 1024).toFixed(0)} KB {d.source === 'HR' && <Badge tone="info" className="ml-1">From HR</Badge>}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" aria-label={`Download ${d.fileName}`} onClick={() => downloadFile(`/documents/${d.id}/file`, d.fileName).catch((e) => toast.error(e.message))}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {!self && (hrDocs || hrOnboarding) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove document"
                          onClick={async () => {
                            if (await confirm({ title: 'Remove document?', body: 'The employee will no longer see it.', danger: true, confirmLabel: 'Remove' })) remove.mutate(d.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </CardBody>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Upload document"
        description="PDF, JPG, PNG or WEBP up to 10 MB."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={upload} loading={busy}>
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Document type">
            {(a) => (
              <Select {...a} value={category} onChange={(e) => setCategory(e.target.value as DocCategory)}>
                {options.map((c) => (
                  <option key={c} value={c} disabled={self && uploaded.has(c) && c !== 'OTHER_ONBOARDING'}>
                    {DOC_CATEGORY_LABELS[c]}
                    {self && uploaded.has(c) && c !== 'OTHER_ONBOARDING' ? ' (submitted)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Title (optional)">{(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />}</Field>
          <Field label="File">{(a) => <Input {...a} ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="pt-1.5" />}</Field>
        </div>
      </Dialog>
      {node}
    </Card>
  );
}

interface Position {
  id: string;
  designation: string;
  levelCode: string;
  levelTitle: string;
  departmentName: string;
  salary: number | null;
  startDate: string;
  endDate: string | null;
  changeType: string;
}

/** B8 – timeline of every position held (only when promoted at least once, per spec). */
export function CareerTimeline({ employeeId, currency, alwaysShow }: { employeeId: string; currency: string; alwaysShow?: boolean }) {
  const { data, isLoading } = useApi<Position[]>(`/employees/${employeeId}/positions`);
  if (isLoading) return <LoadingRows rows={2} />;
  const promoted = data?.some((p) => p.changeType === 'PROMOTED');
  if (!promoted && !alwaysShow) return null;
  return (
    <Card>
      <CardHeader title="Promotion history" description="Every position held, with start and end month." />
      <CardBody>
        <ol className="relative space-y-5 border-l pl-6">
          {[...(data ?? [])].reverse().map((p, i) => (
            <li key={p.id} className="relative">
              <span className={`absolute top-1 -left-[31px] h-3 w-3 rounded-full border-2 border-card ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} aria-hidden />
              <p className="text-sm font-medium">
                {p.levelCode} – {p.designation}
              </p>
              <p className="text-xs text-muted-foreground">
                {monthLabel(p.startDate.slice(0, 7))} – {p.endDate ? monthLabel(p.endDate.slice(0, 7)) : 'Present'} · {p.departmentName}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone={p.changeType === 'PROMOTED' ? 'success' : p.changeType === 'JOINED' ? 'info' : 'neutral'}>{p.changeType.toLowerCase()}</Badge>
                {i === 0 && <Badge tone="primary">current</Badge>}
                {p.salary !== null && <span className="text-xs text-muted-foreground">{money(p.salary, currency)}</span>}
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
