import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';
import { JobsService } from './jobs.service';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Emails are always sent via the job queue (retries, and only after the transaction commits). */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger('Mail');
  private transporter?: Transporter;

  constructor(private readonly jobs: JobsService) {}

  onModuleInit() {
    const url = config().SMTP_URL;
    if (url) this.transporter = nodemailer.createTransport(url);
    this.jobs.register('email', async (p) => this.deliver(p as unknown as MailMessage));
  }

  send(msg: MailMessage) {
    return this.jobs.enqueue('email', { ...msg });
  }

  private async deliver(msg: MailMessage) {
    if (!this.transporter) {
      // Development: no SMTP configured – print instead of sending.
      this.logger.log(`\n----- EMAIL (dev) -----\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n-----------------------`);
      return;
    }
    await this.transporter.sendMail({ from: config().MAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text });
  }
}
