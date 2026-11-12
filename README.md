# HRMS – multi-tenant HR SaaS

Employee records, attendance, leave, payroll, performance, compliance and community in one secure
workspace per company. Built from *HRMS – Requirements Specification (Revised)*; code comments
reference its sections (A1, B7, C3 …).

- **API**: NestJS 11 · PostgreSQL (Row-Level Security) · Drizzle ORM · Argon2id · Zod
- **Web**: Next.js 16 · React 19 · Tailwind CSS 4 · TanStack Query · Radix UI · GSAP (homepage animations)
- **Shared**: permission catalogue, workflows and Zod schemas used by both

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).

## Who is who

| Role | Where | What they do |
|---|---|---|
| **Super Admin** | `/platform` (separate login) | Runs the SaaS: creates companies and their Company Admins, plans and pricing, platform currency, logo, favicon and sign-in footer. |
| **Company Admin** | Company workspace | Everything inside one company: all HR and Operations permissions, roles and access, settings, and permanent deletes. |
| **HR · Operations · Team Lead · Employee** | Company workspace | Permissions per role, editable by the Company Admin. |

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

<http://localhost:3000> is the public homepage (features, plans from the database, sign in).

There is **no public sign-up**. Create your Super Admin account once (uses `PLATFORM_ADMIN_*` from `.env`, or pass flags):

```bash
npm run build -w @hrms/api && npm run platform:admin -- --email you@example.com --name "Your Name"
```

Sign in at <http://localhost:3000/platform/login>. **New company** creates a client workspace with its own email domain
(e.g. `prepecomalign.com`) and a Company Admin, either with generated sign-in details shown to you once, or with an
email link so they set their own password. Or load a demo company:

```bash
node scripts/seed-demo.mjs   # login details are written to demo-credentials.local.md
```

## Super Admin console

- **Companies**: create, suspend, change plan or modules, employee limit and email domain; resend the welcome email.
- **Platform settings → Plans & pricing**: what you sell. The homepage shows active plans live.
- **Platform settings → General**: the platform currency (every plan and the homepage use it; changing it updates all
  plans at once), the sign-in page footer (`{year}` is filled in), and the platform logo and favicon.
- **Super Admins** and **Email** (SMTP status and test email).

## Company highlights

- Employees sign in with email and password only; emails are unique across the platform and use the company's domain.
- Terminated employees stay listed with all their records and can be **reactivated** (login restored), or **deleted
  permanently** by someone with the "Delete records" permission.
- HR and Company Admins correct attendance directly; employees request corrections that go through approval.
- Light and dark mode everywhere.

## Going live (SaaS)

All deployment settings are environment variables – no code edits. Set these on the hosting platform:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DATABASE_ADMIN_URL` | App (RLS) and migration connections |
| `APP_URL` | Public URL, used in emails |
| `JWT_SECRET`, `DATA_HMAC_SECRET`, `DATA_ENCRYPTION_KEY` | Secrets – generate once, never change after data exists |
| `COOKIE_SECURE=true`, `NODE_ENV=production` | Required in production |
| `SMTP_URL`, `MAIL_FROM` | Outgoing email |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_TAGLINE`, `NEXT_PUBLIC_SUPPORT_EMAIL` | Name and tagline; the support email powers "Get started" / "Contact us" on the homepage |
| `API_INTERNAL_URL` | Only when web and API run as separate servers (not on Vercel) |

Then run `npm run db:migrate` and `npm run platform:admin -- --email … --name …` once against the production database.
Run `npm run db:migrate` again after every update: it applies new migrations and re-applies the security hardening
(RLS policies, grants, same-company foreign keys). Logo, favicon, currency and footer are then set in the Super Admin console.

## Tests

```bash
npm test -w @hrms/api                     # unit tests: attendance rules, payroll maths
node scripts/smoke.mjs                    # auth & CSRF (API must be running)
node scripts/e2e-flows.mjs                # full multi-role workflows, tenant isolation, platform settings
node scripts/cleanup-test-companies.mjs   # removes leftover e2e/smoke test companies
```

The e2e and smoke scripts delete the companies they create. Logins are rate-limited (10/min per IP), so wait a
minute between full e2e runs.

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
| Platform (SaaS operator) | `modules/platform` (companies, plans, settings, branding, public homepage data) · `/platform/*`, `/` |
