'use strict';
// Production entry for single-process Node hosts (e.g. Hostinger "Node.js web app").
//
// One HTTP server on $PORT:
//   /api/*, /iclock/*, /health -> NestJS API, mounted in-process (no second port)
//   everything else  -> Next.js web app
// It starts listening immediately (the host expects listen() within seconds) and answers
// 503 "Starting up" until both apps are ready.
//
// On every start it also, under a Postgres advisory lock (so several instances starting
// at once don't collide):
//   1. creates/updates the hrms_app role   (needs DATABASE_ADMIN_URL + PG_APP_PASSWORD)
//   2. runs migrations + RLS hardening       (safe to repeat)
//
// Uploads: a relative STORAGE_DIR is placed in the home directory (~/hrms-storage by default)
// so files survive redeploys.
//
// Build first with: npm run build
// Keep thread counts low: shared hosting caps processes+threads per account (Hostinger: 120).
// Must be set before anything touches the libuv thread pool or native thread pools.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '2';
process.env.RAYON_NUM_THREADS = process.env.RAYON_NUM_THREADS || '1';

const { spawn } = require('node:child_process');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const root = __dirname;
const apiDir = path.join(root, 'apps', 'api');
const webDir = path.join(root, 'apps', 'web');
const log = (...a) => console.log('[server]', ...a);
const MIGRATION_LOCK_ID = 72451901;
const DEMO_LOCK_ID = 72451902;

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || 'true';
process.env.HRMS_EMBEDDED = '1'; // apps/api/dist/main.js: don't listen on API_PORT
const storage = process.env.STORAGE_DIR;
if (!storage || !path.isAbsolute(storage)) {
  process.env.STORAGE_DIR = path.join(os.homedir(), 'hrms-storage');
}

let apiHandler = null;
let webHandler = null;
let startupFailed = false;

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  // /iclock/* are fixed paths used by ZKTeco biometric devices (BIO-01).
  const isApi = url.startsWith('/api/') || url.startsWith('/iclock/') || url === '/health' || url.startsWith('/health?');
  // Cold start: hold the request until both apps are ready (up to 60s) instead of failing it.
  const started = Date.now();
  const serve = () => {
    const handler = isApi ? apiHandler : webHandler;
    if (handler) return handler(req, res);
    if (startupFailed || Date.now() - started > 60_000) {
      res.statusCode = 503;
      res.setHeader('Retry-After', '5');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end(startupFailed ? 'Service failed to start - check the server logs.' : 'Still starting up, please retry in a few seconds.');
    }
    setTimeout(serve, 150);
  };
  serve();
});
const port = process.env.PORT || 3000;
server.listen(port, () => log('listening on ' + port));

function runNode(script, cwd, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
    child.on('exit', (code) => resolve(code));
    child.on('error', (err) => {
      log('could not run ' + script + ': ' + err.message);
      resolve(1);
    });
  });
}

/** True when every migration in apps/api/drizzle has already been applied (skips a slow child process). */
async function migrationsUpToDate(client) {
  try {
    const journal = require(path.join(apiDir, 'drizzle', 'meta', '_journal.json'));
    const r = await client.query('SELECT count(*)::int AS n FROM public.__drizzle_migrations');
    return r.rows[0].n >= journal.entries.length;
  } catch {
    return false;
  }
}

async function prepareDatabase() {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) {
    log('DATABASE_ADMIN_URL not set - skipping role setup and migrations');
    return;
  }
  const { Client } = require(require.resolve('pg', { paths: [apiDir] }));
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    const pw = process.env.PG_APP_PASSWORD;
    if (pw) {
      const lit = "'" + pw.replace(/'/g, "''") + "'";
      const r = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'hrms_app'");
      if (r.rowCount === 0) {
        await client.query('CREATE ROLE hrms_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ' + lit);
        log('created database role hrms_app');
      } else {
        await client.query('ALTER ROLE hrms_app PASSWORD ' + lit);
      }
    }
    if (await migrationsUpToDate(client)) {
      log('database schema up to date');
    } else {
      const code = await runNode('dist/db/migrate.js', apiDir);
      if (code !== 0) log('migrations failed (exit ' + code + ')');
    }
    // Platform owner (Super Admin of the SaaS): created or its password reset from the env, when both are set.
    if (process.env.PLATFORM_ADMIN_EMAIL && process.env.PLATFORM_ADMIN_PASSWORD) {
      const code = await runNode('dist/db/create-platform-admin.js', apiDir);
      log(code === 0 ? 'platform owner ready' : 'platform owner setup failed (exit ' + code + ')');
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    await client.end().catch(() => {});
  }
}

/**
 * SEED_DEMO=1: once, fills a read-only demo company (scripts/seed-demo.mjs, through our own API) and marks
 * it as the website's live demo. Skipped when the demo workspace already exists. Needs PLATFORM_ADMIN_*.
 */
async function seedDemoIfRequested() {
  if (process.env.SEED_DEMO !== '1' || !process.env.DATABASE_ADMIN_URL) return;
  if (!process.env.PLATFORM_ADMIN_EMAIL || !process.env.PLATFORM_ADMIN_PASSWORD) {
    log('SEED_DEMO needs PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD - skipping');
    return;
  }
  const workspace = process.env.DEMO_WORKSPACE || 'demo';
  const { Client } = require(require.resolve('pg', { paths: [apiDir] }));
  const client = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await client.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [DEMO_LOCK_ID]);
    if (!lock.rows[0].ok) return; // another instance is seeding
    const findTenant = async () => (await client.query('SELECT id, is_demo FROM tenants WHERE slug = $1', [workspace])).rows[0];
    let tenant = await findTenant();
    if (!tenant) {
      log('seeding demo company "' + workspace + '"');
      const code = await runNode('scripts/seed-demo.mjs', root, {
        API_URL: 'http://127.0.0.1:' + port + '/api/v1',
        DEMO_WORKSPACE: workspace,
      });
      if (code !== 0) log('demo seeding failed (exit ' + code + ')');
      tenant = await findTenant();
    }
    if (tenant && !tenant.is_demo) {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.id]);
      await client.query('UPDATE tenants SET is_demo = true WHERE id = $1', [tenant.id]);
      await client.query('COMMIT');
      log('demo company "' + workspace + '" is now the live demo');
    }
    await client.query('SELECT pg_advisory_unlock($1)', [DEMO_LOCK_ID]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    log('demo setup failed: ' + err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

async function startApi() {
  const { createApiApp } = require(path.join(apiDir, 'dist', 'main.js'));
  const app = await createApiApp();
  await app.init();
  const expressApp = app.getHttpAdapter().getInstance();
  apiHandler = (req, res) => expressApp(req, res);
  log('API ready');
}

async function startWeb() {
  const nextMod = require(require.resolve('next', { paths: [webDir] }));
  const next = nextMod.default || nextMod;
  const app = next({ dev: false, dir: webDir });
  await app.prepare();
  webHandler = app.getRequestHandler();
  log('web ready');
}

(async () => {
  const web = startWeb().catch((err) => {
    startupFailed = true;
    console.error('[server] web failed to start', err);
  });
  try {
    await prepareDatabase();
  } catch (err) {
    log('database preparation failed: ' + err.message);
  }
  try {
    await startApi();
  } catch (err) {
    startupFailed = true;
    console.error('[server] API failed to start', err);
  }
  await web;
  if (apiHandler) await seedDemoIfRequested();
})();

function shutdown() {
  server.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
