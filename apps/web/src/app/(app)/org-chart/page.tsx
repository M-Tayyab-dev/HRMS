'use client';

import { HIERARCHY_LABELS, HIERARCHY_TIERS, type HierarchyTier } from '@hrms/shared';
import { Network } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Card, EmptyState, LoadingRows, PageHeader } from '@/components/ui/display';
import { cn } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface Node {
  id: string;
  fullName: string;
  designation: string;
  avatarFileId: string | null;
  departmentName: string;
  hierarchyTier: HierarchyTier;
  reportingManagerId: string | null;
}

function Person({ n, small }: { n: Node; small?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 rounded-md border bg-card p-2.5 shadow-xs', small ? 'min-w-48' : 'min-w-56')}>
      <Avatar name={n.fullName} fileId={n.avatarFileId} size={small ? 'sm' : 'md'} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{n.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{n.designation} · {n.departmentName}</p>
      </div>
    </div>
  );
}

function Tree({ node, children: kids, all }: { node: Node; children: Node[]; all: Map<string, Node[]> }) {
  const [open, setOpen] = useState(true);
  return (
    <li className="relative">
      <div className="flex items-center gap-2">
        {kids.length > 0 && (
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? `Collapse ${node.fullName}'s reports` : `Expand ${node.fullName}'s reports`} className="flex h-5 w-5 items-center justify-center rounded border text-xs text-muted-foreground hover:bg-muted">
            {open ? '−' : '+'}
          </button>
        )}
        <Person n={node} small />
        {kids.length > 0 && <span className="text-xs text-muted-foreground">{kids.length} report{kids.length === 1 ? '' : 's'}</span>}
      </div>
      {open && kids.length > 0 && (
        <ul className="mt-2 ml-2.5 space-y-2 border-l pl-6">
          {kids.map((k) => <Tree key={k.id} node={k} children={all.get(k.id) ?? []} all={all} />)}
        </ul>
      )}
    </li>
  );
}

/** B5 – company structure from Director/CEO down to team members. */
export default function OrgChartPage() {
  const { data, isLoading } = useApi<Node[]>('/directory/org-chart');
  const [view, setView] = useState<'tiers' | 'reporting'>('tiers');
  const { byTier, roots, children } = useMemo(() => {
    const list = data ?? [];
    const ids = new Set(list.map((n) => n.id));
    const children = new Map<string, Node[]>();
    for (const n of list) if (n.reportingManagerId && ids.has(n.reportingManagerId)) children.set(n.reportingManagerId, [...(children.get(n.reportingManagerId) ?? []), n]);
    const order = (n: Node) => HIERARCHY_TIERS.indexOf(n.hierarchyTier);
    const roots = list.filter((n) => !n.reportingManagerId || !ids.has(n.reportingManagerId)).sort((a, b) => order(a) - order(b));
    const byTier = HIERARCHY_TIERS.map((t) => ({ tier: t, people: list.filter((n) => n.hierarchyTier === t) })).filter((g) => g.people.length);
    return { byTier, roots, children };
  }, [data]);

  return (
    <>
      <PageHeader
        title="Organisation chart"
        description="Company structure from top to bottom."
        actions={
          <div className="flex rounded-md border p-0.5" role="group" aria-label="View">
            {(['tiers', 'reporting'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={cn('rounded px-3 py-1 text-sm', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                {v === 'tiers' ? 'By level' : 'Reporting lines'}
              </button>
            ))}
          </div>
        }
      />
      {isLoading ? (
        <Card><LoadingRows /></Card>
      ) : !data?.length ? (
        <Card><EmptyState icon={Network} title="No one here yet" /></Card>
      ) : view === 'tiers' ? (
        <div className="space-y-6">
          {byTier.map((g, i) => (
            <section key={g.tier} aria-label={HIERARCHY_LABELS[g.tier]}>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{i + 1}</span>
                <h2 className="text-sm font-semibold">{HIERARCHY_LABELS[g.tier]}</h2>
                <span className="text-xs text-muted-foreground">{g.people.length}</span>
              </div>
              <div className="flex flex-wrap gap-3">{g.people.map((n) => <Person key={n.id} n={n} />)}</div>
            </section>
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto p-5">
          <ul className="space-y-3">{roots.map((r) => <Tree key={r.id} node={r} children={children.get(r.id) ?? []} all={children} />)}</ul>
        </Card>
      )}
    </>
  );
}
