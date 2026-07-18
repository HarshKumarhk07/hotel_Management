# KDS Backend — API

Node.js + Express + TypeScript REST API with Socket.io. Implemented so far:
**Phase 1 — Foundation, Auth & Security**, **Phase 2 — Kitchens, Rooms & QR**,
**Phase 3 — Menu & Categories**, **Phase 4a — Cart & Orders**,
**Phase 4b — Payments (Razorpay) & Refunds**, **Phase 5 — Notifications**, and
**Phase 6 — Coupons & Analytics**.

## Quick start

```bash
cd backend
cp .env.example .env          # fill in values (see below)
npm install
npm run dev                   # http://localhost:5000
```

- API base: `http://localhost:5000/api/v1`
- Swagger docs: `http://localhost:5000/docs`
- Health check: `GET /api/v1/health`

### Required env before boot

The process validates env on startup (`src/config/env.ts`) and **exits** if
anything is missing/invalid. Minimum to boot locally:

| Var | Notes |
|-----|-------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` | each ≥ 32 chars (`openssl rand -base64 48`) |
| `ADMIN_SECRET_CODE`, `KITCHEN_SECRET_CODE` | ≥ 6 chars; extra login factor for privileged roles |
| `APP_URL`, `API_URL`, `CORS_ORIGINS` | URLs + CORS allowlist |

Optional (features degrade gracefully if absent): `BREVO_API_KEY` (emails are
logged instead of sent), `GOOGLE_CLIENT_ID/SECRET` (Google sign-in disabled).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Hot-reload dev server (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest + in-memory Mongo (no external DB needed) |
| `npm run test:coverage` | Coverage report (thresholds enforced) |

## Architecture

```
src/
├── config/        env (zod-validated), db, logger (pino), swagger
├── constants/     roles, enums, password policy, token settings
├── models/        Mongoose: User, Kitchen, Room, Category, MenuItem, Cart,
│                  Order, Notification, Coupon, CouponRedemption,
│                  RefreshToken, VerificationToken, AuditLog
├── middleware/    security (helmet/sanitize/hpp), rateLimit, validate, upload,
│                  authenticate, authorize (RBAC + tenant), csrf, errorHandler
├── services/      token (rotation + reuse-detection), audit, email (Brevo),
│                  qr, cloudinary (image upload), pricing, payment (Razorpay),
│                  notification (in-app + email), export (CSV/XLSX/PDF)
├── realtime/      socket.io (auth handshake + rooms) + safe emit helpers
├── modules/
│   ├── auth/          routes · controller · service · validation
│   ├── kitchen/       Super Admin tenant management
│   ├── room/          rooms + QR lifecycle + public scan resolve
│   ├── menu/          categories + menu items + public menu
│   ├── cart/          customer server-side cart
│   ├── order/         checkout + order lifecycle + cancellation + internal notes
│   ├── payment/       Razorpay order/verify/webhook + refunds
│   ├── notification/  in-app feed (list / unread / mark read)
│   ├── coupon/        admin CRUD + customer validate (applied at checkout)
│   └── analytics/     dashboards + CSV/Excel/PDF exports
├── realtime/      Socket.io (auth handshake + role/tenant rooms)
├── routes/        API aggregator (/health, /csrf-token, /auth)
├── utils/         AppError, asyncHandler, jwt, crypto, cookies, request, ms
├── app.ts         Express app factory (importable by tests)
└── index.ts       Server bootstrap (DB → app → socket → listen)
```

## Auth & security implemented

- **Tokens** — access JWT (15m) in the response body; refresh JWT (7d) in an
  HttpOnly + Secure + SameSite=Strict cookie scoped to `/api/v1/auth`.
- **Refresh rotation + reuse detection** — every refresh rotates the token and
  revokes the old one. Replaying a rotated token revokes the entire session
  *family* (theft response) and forces re-login.
- **Password security** — bcrypt (12 rounds); policy enforced via Zod
  (8+ chars, upper, lower, number, special). Hashes never serialised.
- **Lockout** — 5 failed attempts → 2-minute lock; security-alert email to the
  user (and the SOC inbox for privileged roles) via Brevo.
- **Privileged gate** — SUPER_ADMIN / KITCHEN_OWNER must supply a secret code at
  login (constant-time compared); Google sign-in cannot bypass it.
- **Email verification & password reset** — single-use, hashed, TTL'd tokens;
  uniform responses to prevent account enumeration; reset revokes all sessions.
- **Hardening** — Helmet (CSP, HSTS, frameguard, noSniff), strict CORS allowlist
  (no wildcards), express-mongo-sanitize, hpp, deep HTML sanitization, CSRF
  (double-submit cookie), per-route rate limits, request-id + structured logs.
- **Audit trail** — append-only `AuditLog` for logins, lockouts, refreshes,
  reuse-detection, password resets, etc. (user, role, action, IP, browser, time).

## Auth endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | – | Register a customer (sends verify email) |
| POST | `/auth/verify-email` | – | Verify via emailed token |
| POST | `/auth/resend-verification` | – | Resend verify link |
| POST | `/auth/login` | – | Email+password (+secretCode for privileged) |
| POST | `/auth/google` | – | Google ID-token sign in/up |
| POST | `/auth/refresh` | cookie | Rotate refresh + new access token |
| POST | `/auth/logout` | cookie | Revoke session, clear cookie |
| POST | `/auth/forgot-password` | – | Request reset link |
| POST | `/auth/reset-password` | – | Reset via emailed token |
| GET  | `/auth/me` | Bearer | Current user |

## Kitchen & Room endpoints (Super Admin)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/kitchens` | Create kitchen (optionally provision owner account) |
| GET | `/kitchens` | List kitchens (paginated, filter by active/search) |
| GET/PATCH | `/kitchens/:id` | Get / update kitchen |
| PATCH | `/kitchens/:id/activate` · `/deactivate` | Toggle kitchen (cascades to owner login) |
| POST | `/rooms` | Create room (auto-generates QR) |
| GET | `/rooms` | List rooms (filter by floor/active/qrActive/search) |
| GET/PATCH/DELETE | `/rooms/:id` | Get / update / delete room |
| PATCH | `/rooms/:id/activate` · `/deactivate` | Toggle room |
| POST | `/rooms/:id/qr/generate` | (Re)generate QR token (invalidates old print) |
| GET | `/rooms/:id/qr/download?format=png\|svg\|dataurl` | Download QR image |
| PATCH | `/rooms/:id/qr/disable` | Disable QR |
| POST | `/rooms/:id/qr/reassign` | Swap QR tokens with another room |
| GET | `/rooms/resolve/:token` | **Public** — scan resolve → room + kitchen |

**QR design:** the printed code encodes `APP_URL/r/<token>` where `<token>` is an
opaque nanoid carrying no room data. The backend resolves it, so a leaked image
reveals nothing and codes are invalidated by rotating the token. Internal notes
are `select:false` and never surface on the public resolve endpoint.

## Menu endpoints

Management routes accept a **Kitchen Owner** (their own kitchen, scope inferred
from the token) or a **Super Admin** (must pass `kitchen` explicitly).

| Method | Path | Purpose |
|--------|------|---------|
| POST/GET | `/menu/categories` | Create / list categories |
| GET/PATCH/DELETE | `/menu/categories/:id` | Get / update / delete (blocked if non-empty) |
| POST/GET | `/menu/items` | Create / list items (filter by category, label, stock, featured…) |
| GET/PATCH/DELETE | `/menu/items/:id` | Get / update / delete (also deletes image) |
| PATCH | `/menu/items/:id/stock` | Toggle in/out of stock |
| POST/DELETE | `/menu/items/:id/image` | Upload-replace / remove image (multipart `image`) |
| GET | `/menu/public/:kitchenId` | **Public** — orderable menu (active + in-stock + in-window) |

**Scheduled availability:** items carry `availability.windows` (e.g. breakfast
07:00–11:00, optional weekday whitelist, overnight-aware). [`utils/availability.ts`](src/utils/availability.ts)
computes "available now" in the item's timezone using `Intl` (no date library),
and the public menu hides off-window items automatically.

## Cart & Order endpoints

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/cart/items` | Customer | Add an item (kitchen inferred from the item) |
| GET/DELETE | `/cart/:kitchenId` | Customer | Get / clear cart (with live pricing preview) |
| PATCH/DELETE | `/cart/:kitchenId/items/:menuItemId` | Customer | Update qty (0 removes) / remove |
| PATCH | `/cart/:kitchenId/note` | Customer | Set order-level note |
| POST | `/orders/checkout` | Customer | Place order from cart |
| GET | `/orders/my` · `/orders/my/:id` | Customer | Order history / track one |
| GET | `/orders` · `/orders/:id` | Staff | List (kitchen-scoped) / get with internal notes |
| PATCH | `/orders/:id/status` | Staff | Advance status (validated transitions) |
| POST | `/orders/:id/cancel` · `/cancel-items` | Staff | Full / partial cancellation |
| POST | `/orders/:id/notes` | Staff | Add a private internal note |

**Pricing integrity:** the cart stores no prices. At checkout, [`pricing.service.ts`](src/services/pricing.service.ts)
recomputes every line from the live menu (tax per line + kitchen service charge),
so a stale or tampered cart can never lock in an old or fake price. The order
freezes those computed values as an immutable snapshot.

**Order lifecycle:** `NEW_ORDER → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY
→ DELIVERED` (plus `REJECTED`/`CANCELLED`), enforced by a transition map. Customers
**cannot** cancel (no route exists for them). Full/partial staff cancellation
recomputes totals and stages refunds (`INITIATED`/`NOT_REQUIRED`). Status changes
emit Socket.io events to the kitchen queue, admins, and the ordering guest.
**Internal notes** are `select:false` and stripped from every customer response.

## Payment & refund endpoints

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/payments/orders/:orderId/razorpay` | Customer | Create a Razorpay order for a pending KDS order |
| POST | `/payments/orders/:orderId/verify` | Customer | Verify checkout-callback signature → settle |
| POST | `/payments/orders/:orderId/failed` | Customer | Mark a failed/abandoned attempt (enables retry) |
| POST | `/payments/webhook` | — (HMAC) | Razorpay webhook (signed; no auth) |
| POST | `/payments/orders/:orderId/refund` | Staff | Process the staged refund |

**Payment security & integrity:**
- Checkout callbacks are settled only after verifying `HMAC_SHA256(orderId|paymentId, key_secret)`
  with a constant-time compare — a forged callback can never mark an order paid (tested).
- The webhook validates `HMAC_SHA256(rawBody, webhook_secret)` against the **exact
  received bytes** (captured via the json parser's `verify` hook), and is mounted
  before auth/rate-limit/CSRF. Handlers are **idempotent** (re-delivery is safe).
- Razorpay orders are held out of the kitchen queue until payment is confirmed —
  `ORDER_NEW` is emitted on successful verification/capture, not at checkout.
- Refunds walk `INITIATED → PROCESSING → REFUNDED/FAILED`; online payments hit the
  gateway, COD/room-billing are settled manually, and the payment record flips to
  `REFUNDED`/`PARTIALLY_REFUNDED` accordingly.

> The test suite mocks the Razorpay SDK (no live keys needed); signature/webhook
> logic runs for real against a configured secret.

## Notifications

Every significant event creates an **in-app notification** (persisted + pushed
over Socket.io `notification:new`) and, for the moments guests care about, a
**Brevo email** — all via [`notification.service.ts`](src/services/notification.service.ts),
which is fire-and-forget and never breaks the triggering action.

| Audience | Triggers |
|----------|----------|
| Customer | order received, accepted, preparing, ready, out-for-delivery, delivered, rejected, cancelled, refund updates |
| Kitchen owner | new (paid/confirmed) order, cancellation |
| Super Admin | payment failure (fan-out to all admins) |

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/notifications?unread=true` | List my feed (+ unread count) |
| GET | `/notifications/unread-count` | Badge count |
| PATCH | `/notifications/:id/read` · `/read-all` | Mark one / all read |

Notifications are strictly per-recipient (tested: a stranger sees none).

## Coupons & Analytics

**Coupons** ([coupon module](src/modules/coupon/)) — fixed or percentage (with an
optional max-discount cap), minimum order value, start/expiry window, total
`usageLimit` and `perUserLimit`. Super Admins manage them; customers preview via
`POST /coupons/validate` and apply by passing `couponCode` at checkout.

| Method | Path | Role |
|--------|------|------|
| POST | `/coupons/validate` | Customer — discount preview |
| POST/GET | `/coupons` | Admin — create / list |
| GET/PATCH/DELETE | `/coupons/:id` | Admin |

At checkout the coupon is **validated, then atomically reserved** (`findOneAndUpdate`
with a `usedCount < usageLimit` guard) before the order is created, and the
reservation is **released if order creation fails** — so a coupon use is never
burned by a failed checkout, and concurrent checkouts can't over-redeem. Per-user
limits are enforced via `CouponRedemption` records. (All tested.)

**Analytics** ([analytics module](src/modules/analytics/)) — Mongo aggregation
pipelines, date-range + tenant scoped (kitchen owners see only their kitchen,
super admins see all or filter by `?kitchen=`):

| Endpoint | Returns |
|----------|---------|
| `/analytics/dashboard` | everything below in one call |
| `/analytics/summary` | revenue, order/pending/completed/cancelled counts, AOV, cancellation rate |
| `/analytics/revenue-trends?granularity=day\|week\|month` | revenue over time |
| `/analytics/top-items` | best + least selling items |
| `/analytics/peak-hours` | order volume by hour |
| `/analytics/refunds` | refund totals by status |
| `/analytics/kitchen-performance` | per-kitchen orders/delivered/cancelled/revenue |
| `/analytics/export?format=csv\|xlsx\|pdf&report=orders\|summary\|top-items` | file download |

Revenue counts only paid orders. Exports stream CSV, Excel (exceljs), or PDF
(pdfkit) — tested down to the XLSX `PK` ZIP magic bytes.

## Roadmap

See the repo root [`README.md`](../README.md) for the full phase plan. The backend
feature set is now complete (auth, kitchens, rooms/QR, menu, cart, orders,
payments, refunds, notifications, coupons, analytics). Next: the **frontend apps**
(Next.js admin / kitchen / customer) consuming this API + Socket.io.
