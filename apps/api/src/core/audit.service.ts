import { Injectable } from '@nestjs/common';
import { als } from '../common/context';
import type { Tx } from '../db/db.service';
import { auditLogs } from '../db/schema';

/** Explicit audit entries for events outside the request interceptor (logins, background jobs). */
@Injectable()
export class AuditService {
  async log(
    tx: Tx,
    e: { tenantId: string; action: string; actorUserId?: string | null; actorLabel?: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> },
  ) {
    const store = als.getStore();
    await tx.insert(auditLogs).values({
      tenantId: e.tenantId,
      actorUserId: e.actorUserId ?? null,
      actorLabel: e.actorLabel ?? null,
      action: e.action,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      ip: store?.ip ?? null,
      userAgent: store?.userAgent?.slice(0, 300) ?? null,
      metadata: e.metadata ?? null,
    });
  }
}
