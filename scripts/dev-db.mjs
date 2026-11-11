// Local PostgreSQL for development (no Docker / system service needed).
// Production uses a managed Postgres or infra/docker-compose.yml instead.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const env = process.env;
const required = ['PG_SUPERUSER_PASSWORD', 'PG_APP_PASSWORD'];
for (const k of required) {
  if (!env[k]) {
    console.error(`Missing ${k}. Run "node scripts/setup-env.mjs" first, then "npm run db:start".`);
    process.exit(1);
  }
}

const port = Number(env.PG_PORT ?? 5433);
const dataDir = resolve(process.cwd(), '.pgdata');
const db = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: env.PG_SUPERUSER_PASSWORD,
  port,
  persistent: true,
  // Always UTF-8 (Windows would otherwise default to WIN1252 and reject Urdu names, emoji, "→").
  initdbFlags: ['--encoding=UTF8', '--locale=C', '--lc-collate=C', '--lc-ctype=C'],
  onLog: () => {},
});

if (!existsSync(resolve(dataDir, 'PG_VERSION'))) {
  console.log('Initialising database cluster in .pgdata …');
  await db.initialise();
}
await db.start();

const admin = new pg.Client({
  host: 'localhost',
  port,
  user: 'postgres',
  password: env.PG_SUPERUSER_PASSWORD,
  database: 'postgres',
});
await admin.connect();
const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'hrms'");
if (exists.rowCount === 0) await admin.query("CREATE DATABASE hrms ENCODING 'UTF8' TEMPLATE template0");
const enc = await admin.query("SELECT pg_encoding_to_char(encoding) AS e FROM pg_database WHERE datname = 'hrms'");
if (enc.rows[0]?.e !== 'UTF8') {
  console.error(`Database "hrms" uses ${enc.rows[0]?.e}, not UTF8. Stop this script, delete the .pgdata folder and run it again.`);
  await admin.end();
  await db.stop();
  process.exit(1);
}
// Application role: no superuser, no BYPASSRLS → Row-Level Security always applies.
const role = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = 'hrms_app'");
const pwLiteral = `'${env.PG_APP_PASSWORD.replace(/'/g, "''")}'`;
if (role.rowCount === 0) {
  await admin.query(`CREATE ROLE hrms_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD ${pwLiteral}`);
} else {
  await admin.query(`ALTER ROLE hrms_app PASSWORD ${pwLiteral}`);
}
await admin.end();

console.log(`PostgreSQL ready on localhost:${port} (database "hrms"). Press Ctrl+C to stop.`);

const shutdown = async () => {
  await db.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
setInterval(() => {}, 1 << 30);
