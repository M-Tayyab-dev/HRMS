import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PERMISSIONS as P, submitPaymentSchema } from '@hrms/shared';
import type { z } from 'zod';
import { currentUser } from '../../common/context';
import { Audit, RequireAny } from '../../common/decorators';
import { zp } from '../../common/zod.pipe';
import { BillingService } from './billing.service';

/**
 * The company's own subscription: plan, prices for both cycles, invoices and how to pay.
 * Works while the workspace is locked for non-payment (the guard lets /billing through).
 */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @RequireAny(P.TENANT_SETTINGS)
  overview() {
    return this.billing.overview(currentUser().tenantId);
  }

  /** "We've paid": method + transaction reference. The Super Admin confirms and unlocks the workspace. */
  @Post('invoices/:id/submit')
  @HttpCode(200)
  @RequireAny(P.TENANT_SETTINGS)
  @Audit('billing.payment_submitted', 'invoice')
  submit(@Param('id', ParseUUIDPipe) id: string, @Body(zp(submitPaymentSchema)) body: z.infer<typeof submitPaymentSchema>) {
    return this.billing.submitPayment(currentUser().tenantId, id, body.paymentMethodId, body.reference);
  }
}
