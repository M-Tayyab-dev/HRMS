import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import { als } from '../common/context';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool: Pool;
  /** Raw handle – only for platform tables (tenants, jobs). Tenant data must go through `tx`. */
  readonly root: Database;

  constructor() {
    this.pool = new Pool({
      connectionString: config().DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      statement_timeout: 30_000,
    });
    this.root = drizzle(this.pool, { schema, casing: 'snake_case' });
  }

  /** The transaction bound to the current request (tenant context already set). */
  get tx(): Tx {
    const tx = als.getStore()?.tx;
    if (!tx) throw new Error('No tenant transaction in context – is the route authenticated?');
    return tx;
  }

  /**
   * Run `fn` inside a transaction with the Postgres RLS tenant set.
   * Nested calls reuse the outer transaction.
   */
  async inTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const store = als.getStore();
    if (store?.tx && store.tenantId === tenantId) return fn(store.tx);
    return this.root.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      if (store) {
        const prev = { tx: store.tx, tenantId: store.tenantId };
        store.tx = tx;
        store.tenantId = tenantId;
        try {
          return await fn(tx);
        } finally {
          store.tx = prev.tx;
          store.tenantId = prev.tenantId;
        }
      }
      return als.run({ tenantId, tx }, () => fn(tx));
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
