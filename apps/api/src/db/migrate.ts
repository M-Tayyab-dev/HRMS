/**
 * Applies schema migrations (as the DB owner), then the security hardening:
 *  - Row-Level Security on every tenant table (FORCE so even the owner is filtered)
 *  - least-privilege grants for the application role
 *  - append-only audit log
 * Safe to run repeatedly.
 */
import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { Client } from 'pg';
import * as schema from './schema';
import { encryptField, isEncrypted } from '../common/crypto';

const APP_ROLE = 'hrms_app';

function tenantTables(): string[] {
  return (Object.values(schema) as unknown[])
    .filter((v): v is PgTable => is(v, PgTable))
    .map((t) => getTableConfig(t))
    .filter((c) => !schema.NON_TENANT_TABLES.includes(c.name) && c.columns.some((col) => col.name === 'tenant_id'))
    .map((c) => c.name);
}

export function hardeningSql(): string {
  const tables = tenantTables();
  const lines: string[] = [
    `GRANT USAGE ON SCHEMA public TO ${APP_ROLE};`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE};`,
    // Tenants are never deleted through the app.
    `REVOKE DELETE ON tenants FROM ${APP_ROLE};`,
    // F5: audit trail is append-only for the application.
    `REVOKE UPDATE, DELETE ON audit_logs FROM ${APP_ROLE};`,
    `REVOKE ALL ON __drizzle_migrations FROM ${APP_ROLE};`,
  ];
  for (const t of tables) {
    lines.push(
      `ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY;`,
      `DROP POLICY IF EXISTS tenant_isolation ON "${t}";`,
      `CREATE POLICY tenant_isolation ON "${t}" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);`,
    );
  }
  // Tenants: readable for workspace lookup at login, but only the current tenant can be modified.
  const cur = `NULLIF(current_setting('app.tenant_id', true), '')::uuid`;
  lines.push(
    `ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE tenants FORCE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS tenants_read ON tenants;`,
    `DROP POLICY IF EXISTS tenants_insert ON tenants;`,
    `DROP POLICY IF EXISTS tenants_update ON tenants;`,
    `CREATE POLICY tenants_read ON tenants FOR SELECT USING (true);`,
    `CREATE POLICY tenants_insert ON tenants FOR INSERT WITH CHECK (true);`,
    `CREATE POLICY tenants_update ON tenants FOR UPDATE USING (id = ${cur}) WITH CHECK (id = ${cur});`,
  );
  return lines.join('\n');
}

/** SEC-05: encrypt confidential values written before field encryption existed. Idempotent. */
const ENCRYPTED_COLUMNS: [table: string, columns: string[]][] = [
  ['employees', ['cnic', 'father_cnic', 'basic_salary']],
  ['employee_positions', ['salary']],
  ['complaints', ['description', 'resolution_note']],
];

async function encryptLegacyValues(client: Client) {
  const { rows: tenantRows } = await client.query<{ id: string }>('select id from tenants');
  let updated = 0;
  for (const { id: tenantId } of tenantRows) {
    await client.query('BEGIN');
    try {
      // RLS is forced even for the owner, so act inside each tenant.
      await client.query(`select set_config('app.tenant_id', $1, true)`, [tenantId]);
      for (const [table, cols] of ENCRYPTED_COLUMNS) {
        const { rows } = await client.query<Record<string, string | null>>(`select id, ${cols.join(', ')} from ${table}`);
        for (const row of rows) {
          const pending = cols.filter((c) => row[c] != null && !isEncrypted(row[c]));
          if (!pending.length) continue;
          const sets = pending.map((c, i) => `${c} = $${i + 2}`).join(', ');
          await client.query(`update ${table} set ${sets} where id = $1`, [row.id, ...pending.map((c) => encryptField(String(row[c])))]);
          updated++;
        }
      }
      // Older payslips copied the CNIC into their snapshot; strip it.
      await client.query(`update payslips set snapshot = snapshot - 'cnic' where snapshot ? 'cnic'`);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }
  return updated;
}

async function main() {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) throw new Error('DATABASE_ADMIN_URL is required for migrations');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: resolve(__dirname, '../../drizzle'), migrationsSchema: 'public' });
    await client.query(hardeningSql());
    const encrypted = await encryptLegacyValues(client);
    console.log(`Migrations applied; RLS enforced on ${tenantTables().length} tenant tables; ${encrypted} rows encrypted.`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
