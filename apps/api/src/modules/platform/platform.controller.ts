import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { companyStatusSchema, createCompanySchema, platformAdminSchema, platformLoginSchema, type CreateCompanyInput } from '@hrms/shared';
import type { Request, Response } from 'express';
import { asc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { hashPassword, verifyPassword } from '../../common/crypto';
import { Public, SkipAudit } from '../../common/decorators';
import { badRequest, conflict } from '../../common/errors';
import { zp } from '../../common/zod.pipe';
import { DbService } from '../../db/db.service';
import { employees, platformAdmins, tenants } from '../../db/schema';
import { AuthService } from '../auth/auth.service';
import { lockMinutesFor, waitText } from '../auth/lockout';
import { PLATFORM_COOKIE, clearPlatformCookie, setPlatformCookie, signPlatformToken, verifyPlatformToken } from '../auth/tokens';

type Admin = typeof platformAdmins.$inferSelect;

/**
 * Platform console for the SaaS operator: create client companies with their Super Admin,
 * suspend or reactivate them, and add other platform owners. Uses its own session cookie,
 * separate from company logins (still protected by the global CSRF check).
 */
@Controller('platform')
@Public()
@SkipAudit()
export class PlatformController {
  constructor(
    private readonly db: DbService,
    private readonly auth: AuthService,
  ) {}

  private async requireAdmin(req: Request): Promise<Admin> {
    const token = req.cookies?.[PLATFORM_COOKIE];
    const claims = typeof token === 'string' ? await verifyPlatformToken(token) : null;
    if (!claims) throw new UnauthorizedException({ message: 'Please sign in to the platform console', code: 'UNAUTHENTICATED' });
    const [admin] = await this.db.root.select().from(platformAdmins).where(eq(platformAdmins.id, claims.sub));
    if (!admin || admin.tokenVersion !== claims.ver) throw new UnauthorizedException({ message: 'Session expired', code: 'UNAUTHENTICATED' });
    return admin;
  }

  /* ---------------- Session ---------------- */

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body(zp(platformLoginSchema)) body: z.infer<typeof platformLoginSchema>, @Res({ passthrough: true }) res: Response) {
    const [admin] = await this.db.root.select().from(platformAdmins).where(eq(platformAdmins.email, body.email));
    const ok = await verifyPassword(admin?.passwordHash, body.password);
    const invalid = () => new UnauthorizedException({ message: 'Email or password is incorrect', code: 'INVALID_CREDENTIALS' });
    if (!admin) throw invalid();
    if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new UnauthorizedException({ message: `Account temporarily locked. Try again in ${waitText(admin.lockedUntil)}.`, code: 'LOCKED' });
    if (!ok) {
      const failed = admin.failedLoginCount + 1;
      const lock = lockMinutesFor(failed);
      await this.db.root.update(platformAdmins).set({ failedLoginCount: failed, lockedUntil: lock ? new Date(Date.now() + lock * 60_000) : null }).where(eq(platformAdmins.id, admin.id));
      throw invalid();
    }
    await this.db.root.update(platformAdmins).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(platformAdmins.id, admin.id));
    setPlatformCookie(res, await signPlatformToken(admin.id, admin.tokenVersion));
    return { ok: true };
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearPlatformCookie(res);
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const a = await this.requireAdmin(req);
    return { id: a.id, name: a.name, email: a.email };
  }

  /* ---------------- Companies ---------------- */

  @Get('companies')
  async companies(@Req() req: Request) {
    await this.requireAdmin(req);
    const rows = await this.db.root.select().from(tenants).orderBy(asc(tenants.name));
    // Employee data is behind RLS, so count inside each company's own scope.
    return Promise.all(
      rows.map(async (t) => {
        const [c] = await this.db.inTenant(t.id, (tx) => tx.select({ n: sql<number>`count(*) filter (where ${employees.employmentStatus} = 'ACTIVE')::int` }).from(employees));
        return { id: t.id, name: t.name, slug: t.slug, status: t.status, timezone: t.timezone, currency: t.currency, activeEmployees: c?.n ?? 0, createdAt: t.createdAt };
      }),
    );
  }

  @Post('companies')
  async createCompany(@Req() req: Request, @Body(zp(createCompanySchema)) body: CreateCompanyInput) {
    const admin = await this.requireAdmin(req);
    const [taken] = await this.db.root.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, body.workspace));
    if (taken) throw conflict('That workspace name is taken', 'WORKSPACE_TAKEN');
    return this.auth.createCompany(body, admin.email);
  }

  @Patch('companies/:id')
  async setStatus(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(zp(companyStatusSchema)) body: z.infer<typeof companyStatusSchema>) {
    await this.requireAdmin(req);
    // Tenants can only be updated from inside their own scope (RLS policy).
    const [row] = await this.db.inTenant(id, (tx) => tx.update(tenants).set({ status: body.status }).where(eq(tenants.id, id)).returning({ id: tenants.id, status: tenants.status }));
    if (!row) throw badRequest('Company not found');
    return row;
  }

  /* ---------------- Platform owners ---------------- */

  @Get('admins')
  async admins(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.db.root
      .select({ id: platformAdmins.id, name: platformAdmins.name, email: platformAdmins.email, lastLoginAt: platformAdmins.lastLoginAt, createdAt: platformAdmins.createdAt })
      .from(platformAdmins)
      .orderBy(asc(platformAdmins.name));
  }

  /** Only an existing platform owner can add another one. */
  @Post('admins')
  async addAdmin(@Req() req: Request, @Body(zp(platformAdminSchema)) body: z.infer<typeof platformAdminSchema>) {
    const admin = await this.requireAdmin(req);
    const [exists] = await this.db.root.select({ id: platformAdmins.id }).from(platformAdmins).where(eq(platformAdmins.email, body.email));
    if (exists) throw conflict('A platform owner with this email already exists', 'EMAIL_TAKEN');
    const [row] = await this.db.root
      .insert(platformAdmins)
      .values({ name: body.name, email: body.email, passwordHash: await hashPassword(body.password), createdByAdminId: admin.id })
      .returning({ id: platformAdmins.id, name: platformAdmins.name, email: platformAdmins.email });
    return row;
  }
}
