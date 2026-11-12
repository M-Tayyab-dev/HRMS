# Security design

| Area | Control |
|---|---|
| Tenant isolation | Postgres Row-Level Security (FORCE) on all 51 tenant tables; app connects as `hrms_app` (no BYPASSRLS); tenant comes only from the verified session. Verified by `scripts/e2e-flows.mjs`. |
| Passwords | Argon2id (m=19 MiB, t=2, p=1); 12+ chars with mixed case and digits; constant-time handling for unknown accounts. |
| Brute force | Per-IP rate limits (login 10/min, signup 5/h, reset 5/15 min); account lock after 5 failures for 15 min, doubling on every further failure (30, 60, 120 … min, max 24 h) – SEC-04. |
| Sessions | 15-min HS256 access token + 14-day rotating refresh token (hashed at rest, reuse detection revokes the family); `HttpOnly; SameSite=Strict; Secure` cookies; `tokenVersion` revokes all tokens on password change / disable. Users are re-validated on every request. Sessions end after the inactivity time Operations sets (default 30 min); only requests made while the person is using the page extend it, background polling does not, and an idle session cannot be refreshed – SEC-03. |
| CSRF | SameSite=Strict + double-submit token header on every mutation. |
| Authorisation | Permission strings per role (editable per tenant, can't grant what you don't hold); data scope (own / team / all) enforced in services; no self-approval in workflows; maker-checker on payroll. |
| Confidentiality (F4) | Salary/CNIC redacted for Team Leads; documents and payslips visible only to the employee and authorised staff. |
| Anonymous complaints (F3) | No user reference, uploader, IP, user-agent or timestamp beyond the date; request logging disabled for that endpoint; one-time tracking code (only its hash is stored). |
| Surveys | Anonymous responses use an HMAC respondent key, preventing double voting without storing identity. |
| Audit (F5) | Every mutation is written in the same transaction as the change, with field-level old → new values for the changed record (AUD-04); audit table is append-only for the app role; secrets/CNIC redacted from logged bodies. |
| Encryption at rest (SEC-05) | CNIC, father's CNIC, basic salary, position salaries and complaint text are AES-256-GCM encrypted by the app before reaching Postgres (`DATA_ENCRYPTION_KEY`, or derived from `DATA_HMAC_SECRET`). `db:migrate` encrypts older plaintext rows. Never change the key once data exists. |
| Files | Size limits, magic-byte content sniffing (client MIME ignored), random storage keys, path-traversal guard, served only via authorised endpoints with `nosniff`. |
| Headers | API: Helmet with `default-src 'none'`. Web: nonce-based CSP, `frame-ancestors 'none'`, HSTS in production, `Permissions-Policy`. |
| Input | Shared Zod schemas validate every body/query on the server (unknown keys stripped); parameterised SQL only. |
| Errors | Uniform error envelope; stack traces and SQL never reach clients. |
| Secrets | Validated at boot (min 32 chars), generated randomly by `scripts/setup-env.mjs`, never committed. |
| Devices | Per-device API keys (shown once, hashed at rest, revocable). ZKTeco ADMS devices are identified by a registered serial number (the protocol has no secret); Hikvision devices carry their key in the listener URL, which is masked in request logs. |

**Limits to know about**
- Policy documents (F1) block right-click, copy and printing in the viewer and watermark the viewer's name. This is a deterrent: anything shown on screen can still be photographed or captured.
- Email delivery uses SMTP when `SMTP_URL` is set; in development emails are printed to the API log.
- Payslip amounts are not field-encrypted (payroll totals are summed in SQL); rely on encrypted Postgres storage for those.
- ZKTeco ADMS trusts the serial number. Anyone who knows a registered serial could post punches, so keep serials private and review held punches.
- Before going live: put the app behind HTTPS, set `COOKIE_SECURE=true`, use managed Postgres backups, move file storage to S3-compatible storage, and add MFA (recommended for HR/Admin roles).
