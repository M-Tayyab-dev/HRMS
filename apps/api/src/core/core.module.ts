import { Global, Module } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { AccessService } from '../modules/auth/access.service';
import { ApprovalsService } from './approvals.service';
import { AuditService } from './audit.service';
import { JobsService } from './jobs.service';
import { MailService } from './mail.service';
import { NotificationsService } from './notifications.service';
import { ScopeService } from './scope.service';
import { StorageService } from './storage.service';

const providers = [
  DbService,
  AccessService,
  AuditService,
  JobsService,
  MailService,
  NotificationsService,
  ScopeService,
  ApprovalsService,
  StorageService,
];

@Global()
@Module({ providers, exports: providers })
export class CoreModule {}
