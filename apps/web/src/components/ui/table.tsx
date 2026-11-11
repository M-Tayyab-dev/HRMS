import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/format';
import { Button } from './button';
import { EmptyState, ErrorState, LoadingRows } from './display';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

/** Responsive data table with loading, empty and error states. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  empty = 'Nothing here yet',
  emptyDescription,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (r: T) => string;
  loading?: boolean;
  error?: Error | null;
  empty?: string;
  emptyDescription?: string;
  onRowClick?: (r: T) => void;
}) {
  if (loading) return <LoadingRows />;
  if (error) return <ErrorState message={error.message} />;
  if (!rows?.length) return <EmptyState title={empty} description={emptyDescription} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => (e.key === 'Enter' ? onRowClick(r) : undefined) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn('border-b last:border-0', onRowClick && 'cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3 align-middle', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav className="flex items-center justify-between border-t px-4 py-3 text-sm" aria-label="Pagination">
      <span className="text-muted-foreground">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
