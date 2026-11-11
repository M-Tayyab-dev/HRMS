import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PERMISSIONS as P, resignationDecisionSchema, resignationSchema } from '@hrms/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import { currentUser } from '../../common/context';
import { Audit } from '../../common/decorators';
import { badRequest, forbidden } from '../../common/errors';
import { one, scoped } from '../../common/util';
import { zp } from '../../common/zod.pipe';
import { ApprovalsService } from '../../core/approvals.service';
import { ScopeService } from '../../core/scope.service';
import { DbService } from '../../db/db.service';
import { departments, employees, resignations } from '../../db/schema';

/** B4 – resignation: employee → Team Lead review → HR final approval. */
@Controller('resignations')
export class ResignationsController {
  constructor(
    private readonly db: DbService,
    private readonly approvals: ApprovalsService,
    private readonly scope: ScopeService,
  ) {}

  @Get()
  async list() {
    const visible = await this.scope.visibleEmployeeIds(P.RESIGNATION_APPROVE_HR, P.RESIGNATION_APPROVE_TL);
    const q = this.db.tx
      .select({
        id: resignations.id,
        employeeId: resignations.employeeId,
        employeeName: employees.fullName,
        designation: employees.designation,
        departmentName: departments.name,
        reason: resignations.reason,
        requestedLastWorkingDate: resignations.requestedLastWorkingDate,
        approvedLastWorkingDate: resignations.approvedLastWorkingDate,
        status: resignations.status,
        currentStep: resignations.currentStep,
        createdAt: resignations.createdAt,
      })
      .from(resignations)
      .innerJoin(employees, eq(employees.id, resignations.employeeId))
      .innerJoin(departments, eq(departments.id, employees.departmentId));
    const rows = await q.where(scoped(resignations.employeeId, visible)).orderBy(desc(resignations.createdAt));
    return Promise.all(rows.map(async (r) => ({ ...r, canDecide: await this.approvals.canDecide('RESIGNATION', r) })));
  }

  @Post()
  @Audit('resignation.submitted', 'resignation')
  async submit(@Body(zp(resignationSchema)) body: z.infer<typeof resignationSchema>) {
    const employeeId = this.scope.requireEmployee();
    const tx = this.db.tx;
    const [open] = await tx
      .select({ id: resignations.id })
      .from(resignations)
      .where(and(eq(resignations.employeeId, employeeId), inArray(resignations.status, ['PENDING', 'APPROVED'])));
    if (open) throw badRequest('You already have an active resignation');
    const r = one(await tx.insert(resignations).values({ tenantId: currentUser().tenantId, employeeId, ...body }).returning());
    const wf = await this.approvals.submit('RESIGNATION', r.id, employeeId, { title: 'Resignation', link: '/resignations' });
    await tx.update(resignations).set({ status: wf.status, currentStep: wf.currentStep }).where(eq(resignations.id, r.id));
    return { ...r, status: wf.status, currentStep: wf.currentStep };
  }

  @Post(':id/withdraw')
  @Audit('resignation.withdrawn', 'resignation')
  async withdraw(@Param('id', ParseUUIDPipe) id: string) {
    const r = one(await this.db.tx.select().from(resignations).where(eq(resignations.id, id)), 'Resignation');
    if (r.employeeId !== currentUser().employeeId) throw forbidden();
    if (r.status !== 'PENDING') throw badRequest('Only pending resignations can be withdrawn');
    await this.db.tx.update(resignations).set({ status: 'CANCELLED', currentStep: null }).where(eq(resignations.id, id));
    await this.approvals.recordCancel('RESIGNATION', id);
    return { id, status: 'CANCELLED' };
  }

  @Post(':id/decision')
  @Audit('resignation.decided', 'resignation')
  async decide(@Param('id', ParseUUIDPipe) id: string, @Body(zp(resignationDecisionSchema)) body: z.infer<typeof resignationDecisionSchema>) {
    const tx = this.db.tx;
    const r = one(await tx.select().from(resignations).where(eq(resignations.id, id)), 'Resignation');
    const wf = await this.approvals.decide('RESIGNATION', r, body.approve, body.comment, { title: 'Resignation', link: '/resignations' });
    const lastDay = body.lastWorkingDate ?? r.requestedLastWorkingDate;
    await tx
      .update(resignations)
      .set({ status: wf.status, currentStep: wf.currentStep, approvedLastWorkingDate: wf.status === 'APPROVED' ? lastDay : null })
      .where(eq(resignations.id, id));
    if (wf.status === 'APPROVED') {
      // Record kept on the profile; the account is disabled after the last working day by the scheduler.
      await tx.update(employees).set({ employmentStatus: 'RESIGNED', exitDate: lastDay }).where(eq(employees.id, r.employeeId));
    }
    return { id, status: wf.status, currentStep: wf.currentStep };
  }

  @Get(':id/history')
  async history(@Param('id', ParseUUIDPipe) id: string) {
    const r = one(await this.db.tx.select().from(resignations).where(eq(resignations.id, id)), 'Resignation');
    await this.scope.assertCanView(r.employeeId, P.RESIGNATION_APPROVE_HR, P.RESIGNATION_APPROVE_TL);
    return this.approvals.history('RESIGNATION', id);
  }
}
