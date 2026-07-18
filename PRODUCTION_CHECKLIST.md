# Production Readiness Checklist

Work through this before opening the platform to real hotel guests. Items marked
✅ are **already implemented** in the backend; ☐ are operational steps you own.

## Secrets & configuration
- ✅ Env validated on boot (process exits on missing/invalid config)
- ☐ All three JWT/cookie secrets generated with `openssl rand -base64 48` (unique per env)
- ☐ `ADMIN_SECRET_CODE` / `KITCHEN_SECRET_CODE` set to strong, non-default values
- ☐ `.env` is **not** committed (it's git-ignored); secrets live in the host's vault
- ☐ `CORS_ORIGINS` lists only real frontend domains — **no wildcards**
- ☐ `NODE_ENV=production` (enables HSTS, Secure cookies, hides error internals)

## Authentication & security
- ✅ Access token 15 min, refresh token 7 days, rotation + reuse-detection
- ✅ bcrypt (12 rounds); password policy (8+, upper/lower/number/special)
- ✅ 5-attempt lockout (2 min) + Brevo security alerts + IP/fingerprint capture
- ✅ Admin/Kitchen secret-code gate (constant-time compare)
- ✅ Helmet (CSP, HSTS, frameguard, noSniff), HttpOnly+Secure+SameSite=Strict cookies
- ✅ Rate limiting on login/register/forgot-password/email-verify/payments/coupons
- ✅ Input validation (Zod) + sanitization (mongo-sanitize, hpp, HTML strip) + CSRF
- ✅ Append-only audit log (logins, lockouts, orders, refunds, coupons, admin actions)
- ☐ Rotate secrets on a schedule; revoke on suspected compromise
- ☐ Put `/docs` behind auth or disable in prod if you don't want public API docs

## Database
- ✅ Connection pooling (max 20) + timeouts; TTL indexes purge sessions/tokens
- ✅ Replica set (Atlas) for transactions; indexes defined on hot query paths
- ☐ Atlas automated backups enabled + restore tested
- ☐ Network access locked down (IP allowlist / private endpoint)
- ☐ Separate DB users/clusters per environment (dev/staging/prod)
- ☐ Build indexes in prod (`autoIndex` is off in prod — create via migration/Atlas)

## Payments
- ✅ Razorpay signature verification (checkout callback + webhook HMAC, raw body)
- ✅ Webhook idempotent; online orders reach kitchen only after payment confirmed
- ✅ Refund state machine (gateway + manual); retry on failed payments
- ☐ Webhook registered in Razorpay with the matching secret + correct events
- ☐ Switch from Razorpay **test** keys to **live** keys
- ☐ Reconciliation process for disputed/partial payments

## Email & media
- ✅ Brevo wrapper degrades gracefully without a key (logs instead of sends)
- ☐ Brevo sender domain verified (SPF/DKIM) to avoid spam folders
- ☐ Cloudinary credentials set; upload limits (5 MB, image-only) confirmed

## Reliability & operations
- ✅ Graceful shutdown (SIGTERM/SIGINT drain + DB close)
- ✅ `/api/v1/health` liveness probe wired into Docker/Render/Railway
- ✅ Structured JSON logs (pino) with secret redaction + per-request IDs
- ☐ Centralised log drain (Datadog/Loki/etc.) + error alerting (Sentry)
- ☐ Uptime monitor hitting `/health`
- ☐ Autoscaling / min-instances set; Socket.io sticky sessions or a Redis adapter
      if you run **more than one** backend instance
- ☐ Define backup/restore + incident runbook

## Quality gates
- ✅ 79 integration/unit tests passing; `tsc --noEmit` clean; coverage thresholds set
- ☐ CI pipeline runs `npm run typecheck` + `npm test` on every PR
- ☐ Load test the checkout + kitchen-queue paths at expected peak volume
- ☐ Dependency audit (`npm audit`) reviewed; Dependabot/renovate enabled

## Go-live
- ☐ Seed the first Super Admin (`npm run seed:admin`)
- ☐ Smoke test the full flow (see DEPLOYMENT.md §10)
- ☐ Print/test physical room QR codes end-to-end (scan → order → kitchen)
- ☐ Verify a real Razorpay payment + a real refund in live mode
- ☐ Confirm customer/kitchen/admin emails arrive (not spam)

---

### Scaling note — multi-instance Socket.io
The realtime layer uses in-memory rooms. To run **multiple** backend instances,
add the official Redis adapter (`@socket.io/redis-adapter`) so events fan out
across instances, and enable sticky sessions at the load balancer. A single
instance needs neither.
