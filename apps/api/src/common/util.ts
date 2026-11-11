import type { Paginated } from '@hrms/shared';
import { eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Tx } from '../db/db.service';
import { tenants, type TenantSettings } from '../db/schema';
import { currentUser } from './context';
import { notFound } from './errors';

export function page<T>(items: T[], total: number, p: { page: number; pageSize: number }): Paginated<T> {
  return { items, total, page: p.page, pageSize: p.pageSize };
}

export const offset = (p: { page: number; pageSize: number }) => (p.page - 1) * p.pageSize;

/** `count(*)` helper: `await tx.select(countCol).from(t).where(w)` → rows[0].n */
export const countCol = { n: sql<number>`count(*)::int` };
export const firstN = (rows: { n: number }[]) => rows[0]?.n ?? 0;

/** Escape LIKE wildcards in user search input. */
export const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function tenantInfo(tx: Tx): Promise<{ id: string; name: string; timezone: string; currency: string; settings: TenantSettings }> {
  const [t] = await tx.select().from(tenants).where(eq(tenants.id, currentUser().tenantId));
  if (!t) throw notFound('Tenant');
  return t;
}

export function one<T>(rows: T[], what = 'Record'): T {
  const r = rows[0];
  if (!r) throw notFound(what);
  return r;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** `col IN (ids)` that is simply false for an empty list. */
export function inIds(col: AnyPgColumn, ids: string[]): SQL {
  return ids.length ? inArray(col, ids) : sql`false`;
}

/** Optional scope filter: `null` means unrestricted. */
export function scoped(col: AnyPgColumn, ids: string[] | null): SQL | undefined {
  return ids === null ? undefined : inIds(col, ids);
}
