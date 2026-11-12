'use client';

/** Thin fetch wrapper: same-origin cookies, CSRF header, one silent refresh on 401. */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

const BASE = '/api/v1';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1];
}

let csrfPromise: Promise<void> | null = null;
async function ensureCsrf() {
  if (readCookie('hrms_csrf')) return;
  csrfPromise ??= fetch(`${BASE}/auth/csrf`, { credentials: 'same-origin' }).then(() => {
    csrfPromise = null;
  });
  await csrfPromise;
}

let refreshPromise: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    await ensureCsrf();
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'x-csrf-token': readCookie('hrms_csrf') ?? '' },
    });
    refreshPromise = null;
    return res.ok;
  })();
  return refreshPromise;
}

/**
 * SEC-03: the API ends a session after the inactivity time set by Operations. Only requests made while a
 * person is actually using the page extend it – background polling (e.g. notification counts) does not.
 */
let lastInteraction = Date.now();
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(ev, () => { lastInteraction = Date.now(); }, { passive: true, capture: true });
  }
}
const userActive = () => Date.now() - lastInteraction < 60_000;

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body, retried = false): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {};
  if (userActive()) headers['x-user-active'] = '1';
  if (method !== 'GET') {
    await ensureCsrf();
    headers['x-csrf-token'] = readCookie('hrms_csrf') ?? '';
  }
  if (body !== undefined && !isForm) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'same-origin',
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  // The platform console has its own session and login page.
  if (res.status === 401 && !retried && !path.startsWith('/auth/') && !path.startsWith('/platform/')) {
    if (await refreshSession()) return request<T>(method, path, body, true);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
  }
  if (res.status === 403 && !retried) {
    const peek = await res.clone().json().catch(() => null);
    if (peek?.code === 'CSRF') {
      document.cookie = 'hrms_csrf=; Max-Age=0; path=/';
      return request<T>(method, path, body, true);
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText, err.issues);
  }
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return (await res.json()) as T;
  return (await res.blob()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Body) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: Body) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: Body) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
  blob: (path: string) => request<Blob>('GET', path),
};

/** Build a query string, dropping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Download an authenticated file (payslip PDF, documents). */
export async function downloadFile(path: string, filename: string) {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
