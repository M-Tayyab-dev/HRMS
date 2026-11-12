import { Injectable } from '@nestjs/common';
import type { Permission, Role } from '@hrms/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AuthUser } from '../../common/context';
import { DbService } from '../../db/db.service';
import { rolePermissions, teams, tenants, userRoles, users } from '../../db/schema';
import { sessionIdleMinutes } from './tokens';

/** Resolves a user's effective roles, permissions and data scope. */
@Injectable()
export class AccessService {
  constructor(private readonly db: DbService) {}

  async load(tenantId: string, userId: string, tokenVersion?: number, session?: { sid: string; active: boolean }): Promise<AuthUser | null> {
    return this.db.inTenant(tenantId, async (tx) => {
      const [u] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!u || u.status !== 'ACTIVE') return null;
      if (tokenVersion !== undefined && u.tokenVersion !== tokenVersion) return null;

      if (session) {
        // SEC-03: end the session after the configured inactivity; real user activity extends it
        // (written at most once a minute to keep requests cheap).
        const [t] = await tx.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId));
        const idle = sessionIdleMinutes(t?.settings);
        const res = await tx.execute(sql`
          with s as (
            select id, last_activity_at from refresh_tokens
            where family_id = ${session.sid} and user_id = ${userId} and revoked_at is null
            order by created_at desc limit 1
          ), touched as (
            update refresh_tokens r set last_activity_at = now() from s
            where r.id = s.id and ${session.active} and s.last_activity_at < now() - interval '1 minute'
              and s.last_activity_at > now() - make_interval(mins => ${idle})
            returning r.id
          )
          select (select last_activity_at > now() - make_interval(mins => ${idle}) from s) as ok`);
        if ((res.rows[0] as { ok: boolean | null } | undefined)?.ok !== true) return null;
      }

      const roleRows = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
      const roles = roleRows.map((r) => r.role as Role);
      const permRows = roles.length
        ? await tx
            .select({ permission: rolePermissions.permission })
            .from(rolePermissions)
            .where(and(eq(rolePermissions.tenantId, tenantId), inArray(rolePermissions.role, roles)))
        : [];

      const ledTeamIds =
        u.employeeId && roles.includes('TEAM_LEAD')
          ? (
              await tx
                .select({ id: teams.id })
                .from(teams)
                .where(and(eq(teams.leadEmployeeId, u.employeeId), eq(teams.isActive, true)))
            ).map((t) => t.id)
          : [];

      return {
        userId: u.id,
        tenantId,
        email: u.email,
        employeeId: u.employeeId,
        roles,
        permissions: new Set(permRows.map((p) => p.permission as Permission)),
        ledTeamIds,
        canPost: u.canPost,
      };
    });
  }
}
