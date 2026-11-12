import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type LoginInput,
} from '@hrms/shared';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { Public, User } from '../../common/decorators';
import type { AuthUser } from '../../common/context';
import { zp } from '../../common/zod.pipe';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE, clearSessionCookies, issueCsrfCookie, setSessionCookies } from './tokens';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Issues the CSRF cookie the web app echoes back on mutations. */
  @Public()
  @Get('csrf')
  csrf(@Res({ passthrough: true }) res: Response) {
    return { csrfToken: issueCsrfCookie(res) };
  }

  // No public sign-up: companies and their Super Admins are created by platform owners (/platform).

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('login')
  async login(@Body(zp(loginSchema)) body: LoginInput, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.login(body);
    setSessionCookies(res, t.access, t.refresh);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const t = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]);
      setSessionCookies(res, t.access, t.refresh);
      return { ok: true };
    } catch (e) {
      clearSessionCookies(res);
      throw e;
    }
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    clearSessionCookies(res);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  async forgot(@Body(zp(forgotPasswordSchema)) body: z.infer<typeof forgotPasswordSchema>) {
    await this.auth.forgotPassword(body.workspace, body.email);
    return { ok: true, message: 'If an account exists, a reset link has been sent.' };
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('reset-password')
  async reset(@Body(zp(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Get('me')
  me() {
    return this.auth.me();
  }

  @Throttle(STRICT)
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @User() user: AuthUser,
    @Body(zp(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const t = await this.auth.changePassword(user.userId, body.currentPassword, body.newPassword);
    setSessionCookies(res, t.access, t.refresh);
    return { ok: true };
  }
}
