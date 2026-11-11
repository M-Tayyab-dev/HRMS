import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { currentUser } from '../../common/context';
import { SkipAudit } from '../../common/decorators';
import { zp } from '../../common/zod.pipe';
import { DbService } from '../../db/db.service';
import { notifications } from '../../db/schema';

/** G4 – notification bell. Read-state changes are not audited (noise). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly db: DbService) {}

  @Get()
  list(@Query(zp(z.object({ unreadOnly: z.coerce.boolean().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }))) q: { unreadOnly?: boolean; limit: number }) {
    const u = currentUser();
    const where = q.unreadOnly ? and(eq(notifications.userId, u.userId), isNull(notifications.readAt)) : eq(notifications.userId, u.userId);
    return this.db.tx.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(q.limit);
  }

  @Get('unread-count')
  async unread() {
    const [r] = await this.db.tx
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, currentUser().userId), isNull(notifications.readAt)));
    return { count: r?.n ?? 0 };
  }

  @SkipAudit()
  @HttpCode(200)
  @Post(':id/read')
  async read(@Param('id', ParseUUIDPipe) id: string) {
    await this.db.tx.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, currentUser().userId)));
    return { ok: true };
  }

  @SkipAudit()
  @HttpCode(200)
  @Post('read-all')
  async readAll() {
    await this.db.tx.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, currentUser().userId), isNull(notifications.readAt)));
    return { ok: true };
  }
}
