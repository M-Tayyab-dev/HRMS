import { Injectable } from '@nestjs/common';
import { PERMISSIONS, type Permission } from '@hrms/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { currentUser, type AuthUser } from '../common/context';
import { forbidden } from '../common/errors';
import { DbService } from '../db/db.service';
import { employees, teamMembers, teams } from '../db/schema';

/**
 * Data-scope rules (F4, H2):
 *  - holders of an org-wide permission see everyone,
 *  - Team Leads see members of the teams they lead,
 *  - everyone else sees only themselves.
 */
@Injectable()
export class ScopeService {
  constructor(private readonly db: DbService) {}

  /** Employee ids led (directly via team) by the user. */
  async teamMemberIds(user: AuthUser = currentUser()): Promise<string[]> {
    if (!user.ledTeamIds.length) return [];
    const rows = await this.db.tx
      .select({ id: teamMembers.employeeId })
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, user.ledTeamIds));
    return rows.map((r) => r.id);
  }

  /**
   * Returns `null` when the user may see all employees for this capability,
   * otherwise the explicit list of visible employee ids.
   */
  async visibleEmployeeIds(allPerm: Permission, teamPerm?: Permission, user: AuthUser = currentUser()): Promise<string[] | null> {
    if (user.permissions.has(allPerm)) return null;
    const ids = new Set<string>();
    if (user.employeeId) ids.add(user.employeeId);
    if (teamPerm && user.permissions.has(teamPerm)) for (const id of await this.teamMemberIds(user)) ids.add(id);
    return [...ids];
  }

  async assertCanView(employeeId: string, allPerm: Permission, teamPerm?: Permission) {
    const ids = await this.visibleEmployeeIds(allPerm, teamPerm);
    if (ids !== null && !ids.includes(employeeId)) throw forbidden();
  }

  async isTeamLeadOf(employeeId: string, user: AuthUser = currentUser()): Promise<boolean> {
    if (!user.ledTeamIds.length) return false;
    const [row] = await this.db.tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.employeeId, employeeId), inArray(teamMembers.teamId, user.ledTeamIds)))
      .limit(1);
    return !!row;
  }

  /** The user account of the lead of the employee's team (for TL approval steps / query routing). */
  async teamLeadOf(employeeId: string): Promise<{ employeeId: string; userId: string | null } | null> {
    const [row] = await this.db.tx
      .select({ leadId: teams.leadEmployeeId, userId: employees.userId })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .innerJoin(employees, eq(employees.id, teams.leadEmployeeId))
      .where(and(eq(teamMembers.employeeId, employeeId), eq(teams.isActive, true)))
      .limit(1);
    return row ? { employeeId: row.leadId, userId: row.userId } : null;
  }

  requireEmployee(user: AuthUser = currentUser()): string {
    if (!user.employeeId) throw forbidden('This action needs an employee profile');
    return user.employeeId;
  }

  readonly P = PERMISSIONS;
}
