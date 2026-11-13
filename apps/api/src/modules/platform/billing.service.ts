import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { config } from '../../config';
import { BILLING_GRACE_DAYS, planPrice, type BillingCycle } from '@hrms/shared';
import { and, asc, desc, eq, inArray, isNotNull, lt, ne } from 'drizzle-orm';
import { badRequest, notFound } from '../../common/errors';
import { addDays, todayIn } from '../../common/tz';
import { DbService } from '../../db/db.service';
import { billingInvoices, platformPaymentMethods, platformPlans, tenants } from '../../db/schema';
import { AccessService } from '../auth/access.service';

type Plan = typeof platformPlans.$inferSelect;

/** Last day of a billing period that starts on `start` (YYYY-MM-DD). */
export function periodEnd(start: string, cycle: BillingCycle): string {
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  const next = cycle === 'ANNUAL' ? new Date(Date.UTC(y + 1, m - 1, d)) : new Date(Date.UTC(y, m, d));
  // Months without that day (e.g. 31 Jan + 1 month) roll back to the month's last day.
  if (cycle === 'MONTHLY' && next.getUTCDate() !== d) next.setUTCDate(0);
  return addDays(next.toISOString().slice(0, 10), -1);
}

/**
 * Subscription billing for companies: invoices per period, payment status and the monthly / annual cycle.
 * There is no card gateway yet: companies pay by one of the Super Admin's payment methods, enter the
 * reference, and the Super Admin marks the invoice paid.
 */
@Injectable()
export class BillingService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Billing');
  private timer?: NodeJS.Timeout;

  onApplicationBootstrap() {
    if (!config().ENABLE_SCHEDULER || process.env.NODE_ENV === 'test') return;
    setTimeout(() => void this.runCycle(), 15_000).unref();
    this.timer = setInterval(() => void this.runCycle(), 60 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  constructor(
    private readonly db: DbService,
    private readonly access: AccessService,
  ) {}

  private async plan(planId: string | null): Promise<Plan | undefined> {
    if (!planId) return undefined;
    const [p] = await this.db.root.select().from(platformPlans).where(eq(platformPlans.id, planId));
    return p;
  }

  private async tenant(tenantId: string) {
    const [t] = await this.db.root.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!t) throw notFound('Company');
    return t;
  }

  /** Tenants can only be changed from inside their own RLS scope. */
  private async updateTenant(tenantId: string, set: Partial<typeof tenants.$inferInsert>) {
    await this.db.inTenant(tenantId, (tx) => tx.update(tenants).set(set).where(eq(tenants.id, tenantId)));
    this.access.forgetAll(); // lock / unlock applies on the next request
  }

  /** Opens an invoice for one period at the plan's current price. */
  async createInvoice(tenantId: string, start?: string) {
    const t = await this.tenant(tenantId);
    const plan = await this.plan(t.planId);
    if (!plan) throw badRequest('Put the company on a plan first', 'NO_PLAN');
    const from = start ?? (t.paidUntil ? addDays(t.paidUntil, 1) : todayIn(t.timezone));
    const [open] = await this.db.root.select({ id: billingInvoices.id }).from(billingInvoices)
      .where(and(eq(billingInvoices.tenantId, tenantId), eq(billingInvoices.periodStart, from), ne(billingInvoices.status, 'VOID')));
    if (open) throw badRequest('There is already an invoice for that period', 'INVOICE_EXISTS');
    const [row] = await this.db.root.insert(billingInvoices).values({
      tenantId,
      planId: plan.id,
      planName: plan.name,
      cycle: t.billingCycle,
      amount: planPrice(plan, t.billingCycle),
      currency: plan.currency,
      periodStart: from,
      periodEnd: periodEnd(from, t.billingCycle),
    }).returning();
    return row!;
  }

  /** Super Admin confirms the money arrived: the company is paid up to the end of that period. */
  async markPaid(invoiceId: string, note?: string) {
    const [inv] = await this.db.root.select().from(billingInvoices).where(eq(billingInvoices.id, invoiceId));
    if (!inv) throw notFound('Invoice');
    if (inv.status === 'VOID') throw badRequest('This invoice was cancelled');
    await this.db.root.update(billingInvoices).set({ status: 'PAID', paidAt: new Date(), note: note ?? inv.note, updatedAt: new Date() }).where(eq(billingInvoices.id, invoiceId));
    const t = await this.tenant(inv.tenantId);
    const paidUntil = !t.paidUntil || inv.periodEnd > t.paidUntil ? inv.periodEnd : t.paidUntil;
    await this.updateTenant(inv.tenantId, { billingStatus: 'PAID', paidUntil });
    return { id: invoiceId, status: 'PAID' as const, paidUntil };
  }

  /** Super Admin: money not received (or refunded). The invoice goes back to pending and the company is locked. */
  async markUnpaid(tenantId: string, invoiceId?: string) {
    if (invoiceId) await this.db.root.update(billingInvoices).set({ status: 'PENDING', paidAt: null, updatedAt: new Date() }).where(and(eq(billingInvoices.id, invoiceId), eq(billingInvoices.tenantId, tenantId)));
    await this.updateTenant(tenantId, { billingStatus: 'UNPAID' });
    return { tenantId, billingStatus: 'UNPAID' as const };
  }

  async voidInvoice(invoiceId: string) {
    await this.db.root.update(billingInvoices).set({ status: 'VOID', updatedAt: new Date() }).where(and(eq(billingInvoices.id, invoiceId), ne(billingInvoices.status, 'PAID')));
    return { id: invoiceId, status: 'VOID' as const };
  }

  /** Company: "we've paid with <method>, reference <x>". Waits for the Super Admin to confirm. */
  async submitPayment(tenantId: string, invoiceId: string, paymentMethodId: string, reference: string) {
    const [m] = await this.db.root.select({ id: platformPaymentMethods.id }).from(platformPaymentMethods).where(and(eq(platformPaymentMethods.id, paymentMethodId), eq(platformPaymentMethods.isActive, true)));
    if (!m) throw badRequest('Choose one of the payment methods shown');
    const [row] = await this.db.root.update(billingInvoices)
      .set({ paymentMethodId, paymentReference: reference, submittedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(billingInvoices.id, invoiceId), eq(billingInvoices.tenantId, tenantId), eq(billingInvoices.status, 'PENDING')))
      .returning({ id: billingInvoices.id });
    if (!row) throw notFound('Invoice');
    return { id: invoiceId, submitted: true };
  }

  async invoices(tenantId: string) {
    return this.db.root.select().from(billingInvoices).where(eq(billingInvoices.tenantId, tenantId)).orderBy(desc(billingInvoices.periodStart), desc(billingInvoices.createdAt));
  }

  async activeMethods() {
    return this.db.root.select().from(platformPaymentMethods).where(eq(platformPaymentMethods.isActive, true)).orderBy(asc(platformPaymentMethods.sortOrder), asc(platformPaymentMethods.name));
  }

  /** What a Company Admin sees on Billing: plan, prices for both cycles, status, invoices and how to pay. */
  async overview(tenantId: string) {
    const t = await this.tenant(tenantId);
    const plan = await this.plan(t.planId);
    const plans = await this.db.root.select().from(platformPlans).where(eq(platformPlans.isActive, true)).orderBy(asc(platformPlans.priceMonthly));
    return {
      billingCycle: t.billingCycle,
      billingStatus: t.billingStatus,
      paidUntil: t.paidUntil,
      plan: plan ? { id: plan.id, name: plan.name, currency: plan.currency, priceMonthly: plan.priceMonthly, priceAnnual: planPrice(plan, 'ANNUAL'), modules: plan.modules, maxEmployees: plan.maxEmployees } : null,
      plans: plans.map((p) => ({ id: p.id, name: p.name, description: p.description, currency: p.currency, priceMonthly: p.priceMonthly, priceAnnual: planPrice(p, 'ANNUAL'), modules: p.modules, maxEmployees: p.maxEmployees })),
      invoices: await this.invoices(tenantId),
      paymentMethods: await this.activeMethods(),
    };
  }

  /**
   * Daily cycle: when a company's paid period has ended, open the next invoice and mark it DUE; after the
   * grace period it becomes UNPAID (workspace locked to Billing until paid).
   */
  async runCycle() {
    const rows = await this.db.root.select().from(tenants)
      .where(and(eq(tenants.status, 'ACTIVE'), eq(tenants.isDemo, false), isNotNull(tenants.paidUntil), inArray(tenants.billingStatus, ['PAID', 'DUE'])));
    for (const t of rows) {
      const today = todayIn(t.timezone);
      if (!t.paidUntil || t.paidUntil >= today) continue;
      try {
        const next = addDays(t.paidUntil, 1);
        const [existing] = await this.db.root.select({ id: billingInvoices.id }).from(billingInvoices)
          .where(and(eq(billingInvoices.tenantId, t.id), eq(billingInvoices.periodStart, next), ne(billingInvoices.status, 'VOID')));
        if (!existing && t.planId) await this.createInvoice(t.id, next);
        const locked = addDays(t.paidUntil, BILLING_GRACE_DAYS) < today;
        const status = locked ? 'UNPAID' : 'DUE';
        if (status !== t.billingStatus) await this.updateTenant(t.id, { billingStatus: status });
      } catch (e) {
        this.logger.error(`Billing cycle failed for ${t.slug}: ${(e as Error).message}`);
      }
    }
  }

  /** Companies whose paid period ended before `date` (for reports). */
  async overdue(date: string) {
    return this.db.root.select({ id: tenants.id, name: tenants.name, paidUntil: tenants.paidUntil }).from(tenants).where(lt(tenants.paidUntil, date));
  }
}
