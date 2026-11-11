import { Injectable } from '@nestjs/common';
import type { Permission, Role } from '@hrms/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { AuthUser } from '../../common/context';
import { DbService } from '../../db/db.service';
import { rolePermissions, teams, userRoles, users } from '../../db/schema';

/** Resolves a user's effective roles, permissions and data scope. */
@Injectable()
export class AccessService {
  constructor(private readonly db: DbService) {}

  async load(tenantId: string, userId: string, tokenVersion?: number): Promise<AuthUser | null> {
    return this.db.inTenant(tenantId, async (tx) => {
      const [u] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!u || u.status !== 'ACTIVE') return null;
      if (tokenVersion !== undefined && u.tokenVersion !== tokenVersion) return null;

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
