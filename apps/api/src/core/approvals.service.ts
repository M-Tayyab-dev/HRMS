import { Injectable } from '@nestjs/common';
import { PERMISSIONS, WORKFLOWS, type ApprovalStepKey, type RequestStatus, type WorkflowStep, type WorkflowType } from '@hrms/shared';
import { and, asc, eq } from 'drizzle-orm';
import { currentUser } from '../common/context';
import { badRequest, forbidden } from '../common/errors';
import { DbService } from '../db/db.service';
import { approvalActions, employees, users } from '../db/schema';
import { NotificationsService } from './notifications.service';
import { ScopeService } from './scope.service';

export interface ApprovableEntity {
  id: string;
  status: RequestStatus | string;
  currentStep: string | null;
  employeeId: string;
}

export interface WorkflowResult {
  status: RequestStatus;
  currentStep: ApprovalStepKey | null;
  /** true when this decision completed the workflow (approved or rejected). */
  final: boolean;
}

interface Describe {
  /** e.g. "Leave request (3 days)" */
  title: string;
  link: string;
}

/** Generic multi-step approval engine (H1). Callers persist status/currentStep on their own table. */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly db: DbService,
    private readonly scope: ScopeService,
    private readonly notify: NotificationsService,
  ) {}

  private steps(type: WorkflowType): readonly WorkflowStep[] {
    return WORKFLOWS[type];
  }

  /** Skip a Team Lead step when the requester has no team lead, or leads their own team. */
  private async resolveStep(type: WorkflowType, fromIndex: number, employeeId: string): Promise<WorkflowStep | null> {
    const steps = this.steps(type);
    for (let i = fromIndex; i < steps.length; i++) {
      const s = steps[i]!;
      if (s.key !== 'TEAM_LEAD') return s;
      const lead = await this.scope.teamLeadOf(employeeId);
      if (lead && lead.employeeId !== employeeId && lead.userId) return s;
    }
    return null;
  }

  private async notifyApprovers(type: WorkflowType, step: WorkflowStep, employeeId: string, d: Describe) {
    const [emp] = await this.db.tx.select({ name: employees.fullName }).from(employees).where(eq(employees.id, employeeId));
    const n = { type: `approval.${type.toLowerCase()}`, title: `${d.title} awaiting your approval`, body: `From ${emp?.name ?? 'an employee'}`, link: d.link };
    if (step.key === 'TEAM_LEAD') {
      const lead = await this.scope.teamLeadOf(employeeId);
      await this.notify.notifyUsers([lead?.userId], n);
    } else {
      await this.notify.notifyPermission(step.permission, n, currentUser().userId);
    }
  }

  /** Start a workflow. Returns the initial status/step to persist. */
  async submit(type: WorkflowType, entityId: string, employeeId: string, d: Describe): Promise<WorkflowResult> {
    const user = currentUser();
    const first = await this.resolveStep(type, 0, employeeId);
    await this.db.tx.insert(approvalActions).values({
      tenantId: user.tenantId,
      workflow: type,
      entityId,
      step: first?.key ?? null,
      action: 'SUBMIT',
      actorUserId: user.userId,
    });
    if (!first) return { status: 'APPROVED', currentStep: null, final: true };
    await this.notifyApprovers(type, first, employeeId, d);
    return { status: 'PENDING', currentStep: first.key, final: false };
  }

  /** Can the current user act on the entity's current step? */
  async canDecide(type: WorkflowType, entity: ApprovableEntity): Promise<boolean> {
    if (entity.status !== 'PENDING' || !entity.currentStep) return false;
    const user = currentUser();
    const step = this.steps(type).find((s) => s.key === entity.currentStep);
    if (!step || !user.permissions.has(step.permission)) return false;
    // No self-approval, except Super Admin for steps with no one else to approve.
    if (user.employeeId === entity.employeeId && !user.roles.includes('SUPER_ADMIN')) return false;
    if (step.key === 'TEAM_LEAD') {
      if (await this.scope.isTeamLeadOf(entity.employeeId, user)) return true;
      // Employees without a team lead: org-wide admins holding the step permission may act.
      const lead = await this.scope.teamLeadOf(entity.employeeId);
      return (!lead || lead.employeeId === entity.employeeId) && user.permissions.has(PERMISSIONS.EMPLOYEES_READ_ALL);
    }
    return true;
  }

  async decide(type: WorkflowType, entity: ApprovableEntity, approve: boolean, comment: string | undefined, d: Describe): Promise<WorkflowResult> {
    if (entity.status !== 'PENDING') throw badRequest('This request has already been decided', 'ALREADY_DECIDED');
    if (!(await this.canDecide(type, entity))) throw forbidden('You are not the approver for this step');
    const user = currentUser();
    const steps = this.steps(type);
    const idx = steps.findIndex((s) => s.key === entity.currentStep);

    await this.db.tx.insert(approvalActions).values({
      tenantId: user.tenantId,
      workflow: type,
      entityId: entity.id,
      step: entity.currentStep,
      action: approve ? 'APPROVE' : 'REJECT',
      actorUserId: user.userId,
      comment,
    });

    const stepLabel = steps[idx]?.label ?? '';
    if (!approve) {
      await this.notify.notifyEmployees([entity.employeeId], {
        type: `decision.${type.toLowerCase()}`,
        title: `${d.title} rejected by ${stepLabel}`,
        body: comment,
        link: d.link,
      });
      return { status: 'REJECTED', currentStep: entity.currentStep as ApprovalStepKey, final: true };
    }

    const next = await this.resolveStep(type, idx + 1, entity.employeeId);
    if (next) {
      await this.notify.notifyEmployees([entity.employeeId], {
        type: `progress.${type.toLowerCase()}`,
        title: `${d.title} approved by ${stepLabel}`,
        body: `Now waiting for ${next.label}`,
        link: d.link,
      });
      await this.notifyApprovers(type, next, entity.employeeId, d);
      return { status: 'PENDING', currentStep: next.key, final: false };
    }
    await this.notify.notifyEmployees([entity.employeeId], {
      type: `decision.${type.toLowerCase()}`,
      title: `${d.title} approved`,
      body: comment,
      link: d.link,
    });
    return { status: 'APPROVED', currentStep: null, final: true };
  }

  async recordCancel(type: WorkflowType, entityId: string, comment?: string) {
    const user = currentUser();
    await this.db.tx.insert(approvalActions).values({
      tenantId: user.tenantId,
      workflow: type,
      entityId,
      action: 'CANCEL',
      actorUserId: user.userId,
      comment,
    });
  }

  async history(type: WorkflowType, entityId: string) {
    return this.db.tx
      .select({
        id: approvalActions.id,
        step: approvalActions.step,
        action: approvalActions.action,
        comment: approvalActions.comment,
        createdAt: approvalActions.createdAt,
        actorEmail: users.email,
      })
      .from(approvalActions)
      .leftJoin(users, eq(users.id, approvalActions.actorUserId))
      .where(and(eq(approvalActions.workflow, type), eq(approvalActions.entityId, entityId)))
      .orderBy(asc(approvalActions.createdAt));
  }
}
