# HRMS – Architecture

Multi-tenant SaaS HRMS built from *HRMS – Requirements Specification (Revised)*.
Section references (A1, B7, C3 …) in code comments point to that document.

## Stack

| Layer | Choice | Why |
|---|---|---|
| API | NestJS 11 (TypeScript) | Modules, guards and interceptors map cleanly to RBAC, audit and tenancy |
| Web | Next.js (App Router) + React 19 + Tailwind CSS 4 | Server-rendered shell, fast dashboards |
| Data fetching | TanStack Query | Caching, optimistic updates, retries |
| Forms / validation | react-hook-form + Zod (schemas shared with the API) | One source of truth for validation |
| DB | PostgreSQL 17 | Row-Level Security for tenant isolation, strong consistency for payroll |
| ORM | Drizzle ORM + drizzle-kit migrations | Typed SQL, no binary engine |
| Jobs | pg-boss (Postgres-backed queue) | Emails, birthday posts, scheduled jobs without extra infra |
| Files | Local disk in dev, S3-compatible in prod (storage interface) | |
| PDFs | pdfkit | Salary slips (D1) |

## Repository layout

```
apps/api        NestJS REST API (/api/v1)
apps/web        Next.js web app (proxies /api to the API → same-origin cookies)
packages/shared Zod schemas, permission catalogue, enums shared by API and web
docs/           Architecture, security, API notes
infra/          Dockerfiles, docker-compose, Postgres init SQL
```

## Multi-tenancy

* Shared database, shared schema; every tenant-owned table has `tenant_id`.
* **Defence in depth**:
  1. API resolves the tenant from the authenticated session (never from the request body).
  2. Every request runs in a transaction that executes `SET LOCAL app.tenant_id = …`.
  3. Postgres **Row-Level Security** policies (`FORCE ROW LEVEL SECURITY`) on every tenant table
     only expose rows where `tenant_id = current_setting('app.tenant_id')`.
     The app connects as a non-owner role (`hrms_app`), so RLS can't be bypassed by a coding mistake.
* Platform-level tables (`tenants`, platform admins) live outside RLS and are only reachable from
  the platform module.

## Identity & access (A1, F4, H2)

* Users authenticate with email + password (Argon2id). Sessions use:
  * short-lived access JWT (15 min) in an `HttpOnly; Secure; SameSite=Strict` cookie,
  * rotating refresh token (hashed in DB, reuse detection revokes the whole family).
* CSRF: same-origin cookies + `SameSite=Strict` + required `X-CSRF-Token` double-submit header on mutations.
* Brute force protection: per-IP and per-account rate limits, account lock after repeated failures.
* RBAC: roles (Super Admin, HR, Operations, Team Lead, Employee) → permission strings
  (`leave.approve.hr`, `payroll.process` …). Tenants can customise role permissions (A1).
* **Data scope** is enforced in services, not just routes: `own` / `team` / `department` / `all`.
  Team Leads only see members of teams they lead (F4).

## Approval engine (H1)

Generic workflow definitions (`leave: TEAM_LEAD → HR`, `payroll: HR → OPERATIONS` …).
Each request row stores its current status and step; `approval_actions` keeps the full history.
Every step emits notifications to the next approvers, and to the requester on decisions.

## Audit trail (F5, H2)

A global interceptor records every mutating request (actor, tenant, action, entity, before/after
diff where available, IP, user agent, timestamp) in `audit_logs` (append-only, enforced by
a DB trigger that blocks UPDATE/DELETE). Anonymous complaints (F3) are excluded from actor capture.

## Confidential data

* Anonymous complaints store **no** link to the submitter; the submitter receives a random tracking code.
* Uploaded files: size limits, MIME sniffing by magic bytes, random storage keys, served only
  through authorised endpoints with `Content-Disposition` and `X-Content-Type-Options: nosniff`.
* Policy documents (F1) render in a viewer that disables right-click/download in the UI and
  watermarks the viewer's name. That's a deterrent only: anything shown on screen can be captured.
