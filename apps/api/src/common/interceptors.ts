import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { from, lastValueFrom, Observable } from 'rxjs';
import { als } from './context';
import { AUDIT_ACTION, SKIP_AUDIT } from './decorators';
import { DbService } from '../db/db.service';
import { auditLogs } from '../db/schema';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REDACT = /pass(word)?|token|secret|otp|cnic|apikey/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT.test(k) ? '[redacted]' : sanitize(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

/**
 * Wraps each authenticated request in one DB transaction with the tenant set for RLS.
 * Registered first, so it is the outermost interceptor.
 */
@Injectable()
export class TenantTxInterceptor implements NestInterceptor {
  constructor(private readonly db: DbService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const tenantId = als.getStore()?.user?.tenantId;
    if (!tenantId) return next.handle();
    return from(this.db.inTenant(tenantId, () => lastValueFrom(next.handle(), { defaultValue: undefined })));
  }
}

/**
 * F5 / H2 – records every successful mutation inside the same transaction as the change,
 * so a change can never be committed without its audit entry.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DbService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const targets = [context.getHandler(), context.getClass()];
    if (!MUTATING.has(req.method) || this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT, targets)) {
      return next.handle();
    }
    const meta = this.reflector.getAllAndOverride<{ action: string; entityType?: string }>(AUDIT_ACTION, targets);

    return from(
      (async () => {
        const result = await lastValueFrom(next.handle(), { defaultValue: undefined });
        const store = als.getStore();
        const tenantId = store?.tenantId ?? store?.user?.tenantId;
        if (!tenantId || !store?.tx) return result;
        const res = context.switchToHttp().getResponse<Response>();
        const anonymous = !!store.anonymous;
        const resultId =
          result && typeof result === 'object' && 'id' in result ? String((result as { id: unknown }).id) : undefined;
        await store.tx.insert(auditLogs).values({
          tenantId,
          actorUserId: anonymous ? null : (store.user?.userId ?? null),
          actorLabel: anonymous ? 'anonymous' : (store.user?.email ?? null),
          action: store.audit?.action ?? meta?.action ?? `${context.getClass().name.replace('Controller', '')}.${context.getHandler().name}`,
          entityType: store.audit?.entityType ?? meta?.entityType ?? null,
          entityId: store.audit?.entityId ?? (req.params?.id as string | undefined) ?? resultId ?? null,
          method: req.method,
          path: req.route?.path ?? req.path,
          statusCode: res.statusCode,
          ip: anonymous ? null : (store.ip ?? null),
          userAgent: anonymous ? null : (store.userAgent?.slice(0, 300) ?? null),
          metadata: anonymous
            ? null
            : ({ body: sanitize(req.body), ...(store.audit?.metadata ?? {}) } as Record<string, unknown>),
        });
        return result;
      })(),
    );
  }
}
