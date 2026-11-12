# HRMS – multi-tenant HR SaaS

Employee records, attendance, leave, payroll, performance, compliance and community in one secure
workspace per company. Built from *HRMS – Requirements Specification (Revised)*; code comments
reference its sections (A1, B7, C3 …).

- **API**: NestJS 11 · PostgreSQL (Row-Level Security) · Drizzle ORM · Argon2id · Zod
- **Web**: Next.js 16 · React 19 · Tailwind CSS 4 · TanStack Query · Radix UI
- **Shared**: permission catalogue, workflows and Zod schemas used by both

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).

## Run it locally (Windows, macOS, Linux)

Requires Node.js 22+. No Docker needed: a local PostgreSQL runs from npm.

```bash
npm install
npm run setup          # creates .env with random secrets, builds the shared package
npm run db:start       # terminal 1 – PostgreSQL on :5433 (keep running)
npm run build -w @hrms/api && npm run db:migrate
npm run dev:api        # terminal 2 – API on :4000
npm run dev:web        # terminal 3 – web on http://localhost:3000
```

Then either create your own company at <http://localhost:3000/signup>, or load a demo company:

```bash
node scripts/seed-demo.mjs   # login details are written to demo-credentials.local.md
```

## Tests

```bash
npm test -w @hrms/api        # unit tests: attendance rules, payroll maths
node scripts/smoke.mjs       # auth & CSRF (API must be running)
node scripts/e2e-flows.mjs   # full multi-role workflows + tenant isolation
```

## Deploy

`infra/docker-compose.yml` runs Postgres, migrations, API and web with non-root, read-only containers.
Put an HTTPS reverse proxy in front of the `web` service. CI is in `.github/workflows/ci.yml`.

## Biometric devices (SRS 5.2)

Register each device under **Attendance → Devices & import**, then point the device at the HRMS:

- **ZKTeco** (ADMS / Push SDK): *Comm. → Cloud Server Setting* → server = your HRMS host, HTTPS on. The device is matched by the serial number you registered and calls `/iclock/cdata`.
- **Hikvision** (ISAPI): *Network → Advanced → HTTP Listening* → `https://<host>/api/v1/attendance/hikvision/<device key>`. ISUP 5.0 needs a separate gateway and isn't supported.

Device user IDs are matched to an employee's biometric ID (or employee code). Unknown IDs are held for HR to link or discard.

## Module map

| Spec | Where |
|---|---|
| A1 Roles & access, A2 dashboards | `modules/access`, `modules/dashboard` · `/access/*`, `/dashboard` |
| B1–B8 Employees, documents, resignation, directory, headcount, levels, promotions | `modules/employees`, `modules/org` |
| C1–C5 Attendance, overtime, leave, holidays, calendar | `modules/attendance`, `modules/leave` |
| D1–D4 Payroll, loans, medical, food allowance | `modules/payroll` |
| E1–E3 KPIs, incentives, surveys | `modules/performance` |
| F1–F7 Policies, guidelines, complaints, confidentiality, audit, queries, surveys | `modules/compliance`, `common/interceptors.ts` |
| G1–G4 Community, announcements, birthdays, notifications | `modules/community`, `modules/dashboard/scheduler.service.ts` |
| H1 Approval workflows | `packages/shared/src/workflows.ts`, `core/approvals.service.ts` |
