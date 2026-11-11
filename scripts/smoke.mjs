// End-to-end smoke test against a running local API (http://localhost:4000).
// Usage: node scripts/smoke.mjs
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';

export class Client {
  jar = new Map();
  async req(method, path, body, { csrf = true, raw = false } = {}) {
    const headers = { 'content-type': 'application/json' };
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.cookie = cookie;
    if (csrf && this.jar.has('hrms_csrf')) headers['x-csrf-token'] = this.jar.get('hrms_csrf');
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, ...v] = pair.split('=');
      const val = v.join('=');
      if (!val || /Expires=Thu, 01 Jan 1970/i.test(c)) this.jar.delete(k);
      else this.jar.set(k, val);
    }
    if (raw) return res;
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
  get = (p) => this.req('GET', p);
  post = (p, b, o) => this.req('POST', p, b, o);
  patch = (p, b) => this.req('PATCH', p, b);
  put = (p, b) => this.req('PUT', p, b);
  del = (p) => this.req('DELETE', p);
}

export function expect(cond, msg, extra) {
  if (!cond) {
    console.error('✗', msg, extra !== undefined ? JSON.stringify(extra, null, 1).slice(0, 800) : '');
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('✓', msg);
}

export const testPassword = () => `Tt1${randomBytes(12).toString('base64url')}`;

async function main() {
  const c = new Client();
  await c.get('/auth/csrf');
  const workspace = `acme-${randomBytes(3).toString('hex')}`;
  const password = testPassword();
  const email = `admin@${workspace}.test`;

  const noCsrf = await c.post('/auth/signup', { companyName: 'Acme', workspace, adminName: 'Ada Admin', email, password }, { csrf: false });
  expect(noCsrf.status === 403, 'signup without CSRF header is rejected', noCsrf);

  const s = await c.post('/auth/signup', { companyName: 'Acme Corp', workspace, adminName: 'Ada Admin', email, password });
  expect(s.status === 201, 'signup creates tenant', s);

  const me = await c.get('/auth/me');
  expect(me.status === 200 && me.data.user.roles.includes('SUPER_ADMIN'), 'me returns super admin', me);

  const anon = new Client();
  const unauth = await anon.get('/auth/me');
  expect(unauth.status === 401, 'unauthenticated /me is 401', unauth);

  await anon.get('/auth/csrf');
  const bad = await anon.post('/auth/login', { workspace, email, password: 'WrongPassword123' });
  expect(bad.status === 401, 'wrong password rejected', bad);
  const good = await anon.post('/auth/login', { workspace, email, password });
  expect(good.status === 200, 'login works', good);
  const refreshed = await anon.post('/auth/refresh');
  expect(refreshed.status === 200, 'refresh rotates session', refreshed);
  console.log(JSON.stringify({ workspace, email }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
