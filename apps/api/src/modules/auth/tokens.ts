import type { CookieOptions, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../../config';
import { randomToken } from '../../common/crypto';

export const ACCESS_COOKIE = 'hrms_at';
export const REFRESH_COOKIE = 'hrms_rt';
export const CSRF_COOKIE = 'hrms_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 14 * 24 * 60 * 60;

const ISSUER = 'hrms-api';
const AUDIENCE = 'hrms-web';
const key = () => new TextEncoder().encode(config().JWT_SECRET);

export interface AccessClaims {
  sub: string; // user id
  tid: string; // tenant id
  ver: number; // token version (bumped to revoke)
  sid?: string; // session (refresh-token family) id, for the inactivity timeout
}

/** SEC-03: minutes without user activity before a session ends; set by Operations (default 30). */
export const DEFAULT_IDLE_MINUTES = 30;
export function sessionIdleMinutes(settings: { sessionIdleMinutes?: number } | null | undefined): number {
  const v = settings?.sessionIdleMinutes;
  return typeof v === 'number' && v >= 5 ? v : DEFAULT_IDLE_MINUTES;
}

/** Sent by the web app only when a person (not a background poll) used the page in the last minute. */
export const ACTIVITY_HEADER = 'x-user-active';

export async function signAccessToken(c: AccessClaims): Promise<string> {
  return new SignJWT({ tid: c.tid, ver: c.ver, ...(c.sid ? { sid: c.sid } : {}) })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(c.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(key());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.tid !== 'string' || typeof payload.ver !== 'number') return null;
    return { sub: payload.sub, tid: payload.tid, ver: payload.ver, sid: typeof payload.sid === 'string' ? payload.sid : undefined };
  } catch {
    return null;
  }
}

function base(): CookieOptions {
  return { httpOnly: true, secure: config().COOKIE_SECURE, sameSite: 'strict' };
}

export function setSessionCookies(res: Response, access: string, refresh: string) {
  res.cookie(ACCESS_COOKIE, access, { ...base(), path: '/', maxAge: ACCESS_TTL_SEC * 1000 });
  res.cookie(REFRESH_COOKIE, refresh, { ...base(), path: '/api/v1/auth', maxAge: REFRESH_TTL_SEC * 1000 });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...base(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(), path: '/api/v1/auth' });
}

/** Double-submit CSRF token: readable by the web app, echoed back in X-CSRF-Token. */
export function issueCsrfCookie(res: Response): string {
  const token = randomToken(24);
  res.cookie(CSRF_COOKIE, token, { httpOnly: false, secure: config().COOKIE_SECURE, sameSite: 'strict', path: '/' });
  return token;
}
