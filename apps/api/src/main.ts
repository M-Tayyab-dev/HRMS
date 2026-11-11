import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { AppModule } from './app.module';
import { als } from './common/context';
import { config } from './config';

async function bootstrap() {
  const cfg = config(); // validate env before anything else
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  app.set('trust proxy', 1); // behind the Next.js proxy / load balancer
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });

  app.use(
    pinoHttp({
      genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
      redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-device-key"]', 'res.headers["set-cookie"]'],
      // F3: never log requests to the anonymous complaint endpoint (IP/time could identify the submitter).
      autoLogging: { ignore: (req) => req.url === '/api/v1/complaints' && req.method === 'POST' },
      transport: cfg.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      level: cfg.NODE_ENV === 'test' ? 'silent' : 'info',
    }),
  );

  // Per-request context (tenant, user, transaction) via AsyncLocalStorage.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    als.run({ ip: req.ip, userAgent: req.header('user-agent') ?? undefined, requestId: String(req.id ?? '') }, next);
  });

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.enableShutdownHooks();
  // No CORS: the web app reaches the API through a same-origin proxy.

  await app.listen(cfg.API_PORT);
  Logger.log(`API listening on http://localhost:${cfg.API_PORT}/api/v1`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
