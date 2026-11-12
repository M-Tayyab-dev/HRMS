import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@hrms/shared';
import type { Request } from 'express';
import { als } from './context';
import { IS_PUBLIC, PERMS_ANY, SKIP_CSRF } from './decorators';
// SKIP_CSRF routes must also be @Public() and authenticate themselves (e.g. device API keys).
import { safeEqual } from './crypto';
import { AccessService } from '../modules/auth/access.service';
import { ACCESS_COOKIE, ACTIVITY_HEADER, CSRF_COOKIE, CSRF_HEADER, verifyAccessToken } from '../modules/auth/tokens';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Double-submit CSRF check on every state-changing request. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [context.getHandler(), context.getClass()])) return true;
    const cookie = req.cookies?.[CSRF_COOKIE];
    const header = req.header(CSRF_HEADER);
    if (typeof cookie !== 'string' || typeof header !== 'string' || !safeEqual(cookie, header)) {
      throw new ForbiddenException({ message: 'Invalid or missing CSRF token', code: 'CSRF' });
    }
    return true;
  }
}

/**
 * Authenticates the session cookie, re-validates the user against the DB on every request
 * (instant revocation), and enforces @RequireAny permissions.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[ACCESS_COOKIE];
    const claims = typeof token === 'string' ? await verifyAccessToken(token) : null;
    if (!claims) throw new UnauthorizedException({ message: 'Please sign in', code: 'UNAUTHENTICATED' });

    const session = claims.sid ? { sid: claims.sid, active: req.header(ACTIVITY_HEADER) === '1' } : undefined;
    const user = await this.access.load(claims.tid, claims.sub, claims.ver, session);
    if (!user) throw new UnauthorizedException({ message: 'Session expired', code: 'UNAUTHENTICATED' });

    const store = als.getStore();
    if (store) {
      store.user = user;
      store.tenantId = user.tenantId;
    }

    const needed = this.reflector.getAllAndOverride<Permission[]>(PERMS_ANY, targets);
    if (needed?.length && !needed.some((p) => user.permissions.has(p))) {
      throw new ForbiddenException({ message: 'You do not have permission to do this', code: 'FORBIDDEN' });
    }
    return true;
  }
}
