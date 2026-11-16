'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/display';

export interface QuickAction {
  href?: string;
  onClick?: () => void;
  label: string;
  description?: string;
  icon: LucideIcon;
}

/** Module overview "Quick actions": links (or buttons) to the module's existing pages. */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (!actions.length) return null;
  const cls = 'flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/50';
  return (
    <Card>
      <CardHeader title="Quick actions" />
      <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ href, onClick, label, description, icon: Icon }) => {
          const inner = (
            <>
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="block font-medium">{label}</span>
                {description && <span className="block text-xs text-muted-foreground">{description}</span>}
              </span>
            </>
          );
          return href ? <Link key={label} href={href} className={cls}>{inner}</Link> : <button key={label} type="button" onClick={onClick} className={cls}>{inner}</button>;
        })}
      </CardBody>
    </Card>
  );
}
