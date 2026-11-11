import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { als } from '../common/context';
import { DbService } from '../db/db.service';
import { jobs } from '../db/schema';

type Handler = (payload: Record<string, unknown>) => Promise<void>;

interface JobRow {
  id: string;
  queue: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

/**
 * Minimal durable job queue on Postgres (FOR UPDATE SKIP LOCKED).
 * enqueue() joins the current request transaction when there is one (transactional outbox),
 * so emails/notifications are only sent if the business change commits.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Jobs');
  private readonly handlers = new Map<string, Handler>();
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(private readonly db: DbService) {}

  register(queue: string, handler: Handler) {
    this.handlers.set(queue, handler);
  }

  async enqueue(queue: string, payload: Record<string, unknown>, opts: { runAt?: Date; dedupeKey?: string } = {}) {
    const exec = als.getStore()?.tx ?? this.db.root;
    await exec
      .insert(jobs)
      .values({ queue, payload, runAt: opts.runAt ?? new Date(), dedupeKey: opts.dedupeKey })
      .onConflictDoNothing({ target: jobs.dedupeKey });
  }

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), 2000);
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /** Process up to 20 due jobs. Exposed for tests. */
  async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      // Recover jobs whose worker died mid-run.
      await this.db.root.execute(
        sql`update jobs set status = 'QUEUED', locked_at = null where status = 'RUNNING' and locked_at < now() - interval '10 minutes'`,
      );
      for (let i = 0; i < 20; i++) {
        const picked = await this.db.root.execute(sql`
          update jobs set status = 'RUNNING', locked_at = now(), attempts = attempts + 1
          where id = (
            select id from jobs where status = 'QUEUED' and run_at <= now()
            order by run_at limit 1 for update skip locked
          )
          returning id, queue, payload, attempts, max_attempts`);
        const job = picked.rows[0] as unknown as JobRow | undefined;
        if (!job) break;
        await this.run(job);
      }
    } catch (err) {
      this.logger.error(`Job loop error: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async run(job: JobRow) {
    const handler = this.handlers.get(job.queue);
    try {
      if (!handler) throw new Error(`No handler for queue ${job.queue}`);
      await handler(job.payload);
      await this.db.root.execute(sql`update jobs set status = 'DONE', locked_at = null, last_error = null where id = ${job.id}`);
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 1000) ?? 'error';
      const final = job.attempts >= job.max_attempts;
      const backoffSec = Math.min(3600, 2 ** job.attempts * 15);
      this.logger.warn(`Job ${job.queue}#${job.id} failed (attempt ${job.attempts}): ${msg}`);
      await this.db.root.execute(sql`
        update jobs set status = ${final ? 'FAILED' : 'QUEUED'}, locked_at = null, last_error = ${msg},
          run_at = now() + make_interval(secs => ${backoffSec})
        where id = ${job.id}`);
    }
  }
}
