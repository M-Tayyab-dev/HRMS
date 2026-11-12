'use client';

import { Check, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApi, useAction } from '@/lib/hooks';
import { Button } from './ui/button';
import { Field, Select, Textarea } from './ui/form';
import { Dialog } from './ui/overlay';

export interface Department {
  id: string;
  name: string;
  code: string;
  headEmployeeId: string | null;
  headName: string | null;
  foodAllowanceEnabled: boolean;
  paidOvertimeEnabled: boolean;
  workScheduleId: string | null;
  isActive: boolean;
  activeEmployees: number;
}
export interface Level {
  id: string;
  departmentId: string;
  code: string;
  rank: number;
  title: string;
  description: string | null;
  defaultSalary: number;
  minSalary: number | null;
  maxSalary: number | null;
  isActive: boolean;
}
export interface DirectoryEntry {
  id: string;
  fullName: string;
  avatarFileId: string | null;
  email: string;
  contactNo: string | null;
  departmentId: string;
  departmentName: string;
  designation: string;
  reportingManagerName: string | null;
  level: string;
  levelCode: string;
  hierarchyTier: string;
  tenure: string;
  since: string | null;
}

export const useDepartments = () => useApi<Department[]>('/departments');
export const useLevels = (departmentId?: string) => useApi<Level[]>(departmentId ? `/levels?departmentId=${departmentId}` : '/levels');
export const useDirectory = () => useApi<DirectoryEntry[]>('/directory');

export function DepartmentSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { includeAll?: string }) {
  const { data } = useDepartments();
  const { includeAll, ...rest } = props;
  return (
    <Select {...rest}>
      <option value="">{includeAll ?? 'Select department…'}</option>
      {data?.filter((d) => d.isActive).map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </Select>
  );
}

export function EmployeeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string; filter?: (e: DirectoryEntry) => boolean }) {
  const { data } = useDirectory();
  const { placeholder, filter, ...rest } = props;
  return (
    <Select {...rest}>
      <option value="">{placeholder ?? 'Select employee…'}</option>
      {data?.filter(filter ?? (() => true)).map((e) => (
        <option key={e.id} value={e.id}>
          {e.fullName} · {e.designation}
        </option>
      ))}
    </Select>
  );
}

/**
 * Approve / reject buttons with an optional comment dialog (H1).
 * `path` receives the decision body { approve, comment }.
 */
export function DecisionButtons({
  path,
  invalidate,
  extra,
  commentLabel = 'Comment (optional)',
  requireCommentOnApprove,
  size = 'sm',
}: {
  path: string;
  invalidate: string[];
  extra?: (approve: boolean) => ReactNode;
  commentLabel?: string;
  requireCommentOnApprove?: string;
  size?: 'sm' | 'md';
}) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [extraState, setExtraState] = useState<Record<string, unknown>>({});
  const act = useAction<Record<string, unknown>>('post', path, {
    invalidate,
    success: mode === 'approve' ? 'Approved' : 'Rejected',
    onSuccess: () => {
      setMode(null);
      setComment('');
    },
  });
  const approve = mode === 'approve';
  const needs = approve && requireCommentOnApprove;
  return (
    <>
      <div className="flex gap-1.5">
        <Button size={size} variant="success" onClick={() => setMode('approve')}>
          <Check className="h-3.5 w-3.5" /> Approve
        </Button>
        <Button size={size} variant="outline" onClick={() => setMode('reject')}>
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
      <Dialog
        open={!!mode}
        onOpenChange={(o) => !o && setMode(null)}
        title={approve ? 'Approve request' : 'Reject request'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              variant={approve ? 'success' : 'danger'}
              loading={act.isPending}
              disabled={!!needs && comment.trim().length < 5}
              onClick={() => act.mutate({ approve, comment: comment || undefined, ...(needs ? { workDescription: comment, remarks: comment } : { remarks: comment || undefined }), ...extraState })}
            >
              {approve ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {extra && <ExtraFields render={extra(approve)} onChange={setExtraState} />}
          <Field label={needs ? requireCommentOnApprove! : commentLabel} required={!!needs}>
            {(a) => <Textarea {...a} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />}
          </Field>
        </div>
      </Dialog>
    </>
  );
}

/** Lets callers inject extra inputs (e.g. approved amount) into the decision dialog via data-field attributes. */
function ExtraFields({ render, onChange }: { render: ReactNode; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <div
      onChange={(e) => {
        const t = e.target as HTMLInputElement;
        const name = t.dataset.field;
        if (!name) return;
        onChange({ [name]: t.type === 'number' ? (t.value === '' ? undefined : Number(t.value)) : t.value });
      }}
    >
      {render}
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
