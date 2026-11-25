// Production entry for single-process Node hosts (e.g. Hostinger "Node.js web app").
// 1. creates/updates the hrms_app database role (needs DATABASE_ADMIN_URL + PG_APP_PASSWORD)
// 2. runs migrations + RLS hardening (safe to repeat)
// 3. starts the NestJS API on a private port (API_PORT, default 4000)
// 4. serves the Next.js web app on $PORT; it proxies /api/v1/* to the API
// Build first with: npm run build
'use strict';
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || 'true';
process.env.API_PORT = process.env.API_PORT || '4000';
process.env.API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:' + process.env.API_PORT;

const root = __dirname;
const apiDir = path.join(root, 'apps', 'api');
const webDir = path.join(root, 'apps', 'web');
const log = (...a) => console.log('[server]', ...a);

async function ensureAppRole() {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  const pw = process.env.PG_APP_PASSWORD;
  if (!adminUrl || !pw) {
    log('DATABASE_ADMIN_URL or PG_APP_PASSWORD not set - skipping hrms_app role setup');
    return;
  }
  const { Client } = require(require.resolve('pg', { paths: [apiDir] }));
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const lit = "'" + pw.replace(/'/g, "''") + "'";
    const r = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'hrms_app'");
    if (r.rowCount === 0) {
      await client.query('CREATE ROLE hrms_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ' + lit);
      log('created database role hrms_app');
    } else {
      await client.query('ALTER ROLE hrms_app PASSWORD ' + lit);
    }
  } finally {
    await client.end();
  }
}

function migrate() {
  if (!process.env.DATABASE_ADMIN_URL) {
    log('DATABASE_ADMIN_URL not set - skipping migrations');
    return;
  }
  const r = spawnSync(process.execPath, ['--enable-source-maps', 'dist/db/migrate.js'], {
    cwd: apiDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) log('migrations failed (exit ' + r.status + ') - continuing');
}

let api;
let stopping = false;
function startApi() {
  api = spawn(process.execPath, ['--enable-source-maps', 'dist/main.js'], {
    cwd: apiDir,
    stdio: 'inherit',
    env: process.env,
  });
  api.on('exit', (code, signal) => {
    if (stopping) return;
    log('API exited (' + (code ?? signal) + '), restarting in 3s');
    setTimeout(startApi, 3000);
  });
}

async function startWeb() {
  const nextMod = require(require.resolve('next', { paths: [webDir] }));
  const next = nextMod.default || nextMod;
  const app = next({ dev: false, dir: webDir });
  const handle = app.getRequestHandler();
  await app.prepare();
  const port = process.env.PORT || 3000;
  http.createServer((req, res) => handle(req, res)).listen(port, () => log('web listening on ' + port));
}

function shutdown() {
  stopping = true;
  if (api) api.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

(async () => {
  try {
    await ensureAppRole();
  } catch (err) {
    log('could not create/update hrms_app role: ' + err.message);
  }
  migrate();
  startApi();
  await startWeb();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
