import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public, SkipAudit } from '../../common/decorators';
import { PlatformSettingsService, type BrandImage } from './platform-settings.service';

/** Public, read-only data for the homepage and sign-in pages (no company data). */
@Controller('public')
@Public()
@SkipAudit()
export class BrandingController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('branding')
  branding() {
    return this.settings.branding();
  }

  @Get('plans')
  plans() {
    return this.settings.publicPlans();
  }

  @Get('logo')
  logo(@Query('v') v: string | undefined, @Res() res: Response) {
    return this.send('logo', v, res);
  }

  /** Falls back to the built-in icon so the browser always gets a favicon. */
  @Get('favicon')
  favicon(@Query('v') v: string | undefined, @Res() res: Response) {
    return this.send('favicon', v, res);
  }

  private async send(kind: BrandImage, version: string | undefined, res: Response) {
    const img = await this.settings.image(kind);
    if (!img) {
      res.setHeader('Cache-Control', 'no-cache');
      return kind === 'favicon' ? res.redirect(302, '/brand-icon.svg') : res.status(404).json({ message: 'No logo set', code: 'NOT_FOUND' });
    }
    res.setHeader('Content-Type', img.type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    // Versioned URLs never change; unversioned ones are checked again soon.
    res.setHeader('Cache-Control', version ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
    return res.send(img.data);
  }
}
