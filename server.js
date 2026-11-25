'use strict';
// Production entry for single-process Node hosts (e.g. Hostinger "Node.js web app").
//
// One HTTP server on $PORT:
//   /api/*, /health  -> NestJS API, mounted in-process (no second port)
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
  const isApi = url.startsWith('/api/') || url === '/health' || url.startsWith('/health?');
  const handler = isApi ? apiHandler : webHandler;
  if (handler) return handler(req, res);
  res.statusCode = 503;
  res.setHeader('Retry-After', '5');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(startupFailed ? 'Service failed to start - check the server logs.' : 'Starting up, please retry in a few seconds.');
});
const port = process.env.PORT || 3000;
server.listen(port, () => log('listening on ' + port));

function runMigrations() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['dist/db/migrate.js'], { cwd: apiDir, stdio: 'inherit', env: process.env });
    child.on('exit', (code) => resolve(code));
    child.on('error', (err) => {
      log('could not run migrations: ' + err.message);
      resolve(1);
    });
  });
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
    const code = await runMigrations();
    if (code !== 0) log('migrations failed (exit ' + code + ')');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
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
})();

function shutdown() {
  server.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
