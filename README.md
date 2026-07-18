# Kitchen Display System (KDS) & QR Room Food Ordering Platform

Enterprise-grade hotel room food ordering platform. Guests scan a QR code in their
room, browse the kitchen menu, pay, and track their order in real time. Kitchen staff
work a live order queue; super admins manage kitchens, rooms, QR codes, coupons,
refunds, and analytics.

## Monorepo layout

```
kitchen/
├── backend/     Node.js + Express + TypeScript REST API + Socket.io
└── frontend/    Next.js 15 (App Router) — admin, kitchen, and customer apps  (later phase)
```

## Roles

| Role         | Scope                                                            |
|--------------|-----------------------------------------------------------------|
| Super Admin  | Full system: kitchens, rooms/QR, refunds, coupons, analytics    |
| Kitchen Owner| Assigned kitchen only: menu, orders, refunds, analytics         |
| Customer     | Browse menu, order, pay, track orders (cannot cancel)           |

## Build status

This repository is being built **backend-first, full depth**. Current slice:

- [x] **Phase 1 — Foundation + Auth + Security**
  - Project scaffolding, config, logging, DB
  - JWT access (15m) + refresh (7d) with rotation & reuse-detection
  - Email/password + Google OAuth + email verification (Brevo)
  - Admin/Kitchen secret-code gate, 5-attempt lockout (2 min), security alert emails
  - Helmet, CORS allowlist, rate limiting, sanitization, CSRF, audit logging
- [x] **Phase 2 — Kitchens + Rooms + QR**
  - Kitchen (tenant) management: create with owner provisioning, list, update,
    activate/deactivate (cascades to owner login)
  - Rooms: CRUD, floor management, activate/deactivate, internal notes
  - QR lifecycle: generate/regenerate, download (PNG/SVG/data-URL), disable,
    reassign (token swap); public scan-resolve endpoint
- [x] **Phase 3 — Menu + Categories**
  - Categories (kitchen-scoped, unique per kitchen, ordering, safe delete)
  - Menu items: price/tax/prep-time, veg/non-veg/Jain labels, featured/recommended
  - Cloudinary image upload/replace/remove (multer in-memory, 5 MB, image-only)
  - Stock toggle + scheduled availability (time/day windows, auto-hide off-window)
  - Public menu endpoint (active + in-stock + in-window only; empty categories hidden)
- [x] **Phase 4a — Cart + Orders**
  - Server-side cart (prices recomputed at checkout; stock/availability validated)
  - Checkout → Order with frozen line pricing, tax-per-line, service charge,
    room snapshot, human-readable order number
  - Lifecycle `NEW_ORDER → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY →
    DELIVERED` with validated transitions; REJECTED/CANCELLED flows
  - Full + partial item cancellation with total recompute & refund staging
  - Internal notes (staff-only, never exposed to customers)
  - Real-time order events to kitchen/admin/customer Socket.io rooms
  - Order schema pre-wired with payment + refund fields for Phase 4b
- [x] **Phase 4b — Payments (Razorpay) + refunds**
  - Create Razorpay order, verify checkout-callback signature (HMAC), settle
  - HMAC-verified webhook (payment.captured/failed, refund.processed), idempotent
  - Failed-payment handling + retry; online orders reach the kitchen only once paid
  - Refund state machine `INITIATED → PROCESSING → REFUNDED/FAILED` (gateway + manual)
- [x] **Phase 5 — Notifications (in-app + Brevo email)**
  - Notification model + service: persists in-app feed, live Socket.io push, email
  - Triggered across the lifecycle: order received/accepted/preparing/ready/
    out-for-delivery/delivered/rejected, cancellation, refund updates
  - Kitchen new-order & cancellation alerts; admin payment-failure fan-out
  - Feed API: list (unread filter), unread count, mark read / read-all
- [x] **Phase 6 — Coupons + Analytics**
  - Coupons: fixed/percent (with cap), min order, expiry/start window, total &
    per-user usage limits; admin CRUD + customer validate/preview
  - Atomic reserve-at-checkout (no over-redemption), redemption records, refund-safe
  - Analytics: revenue, order/status counts, best/least sellers, peak hours,
    refund analytics, kitchen performance — date-range + tenant scoped
  - Exports: CSV, Excel (.xlsx), PDF
- [x] **Backend hardening & ops**
  - Future-ready schemas: Role/permissions, Staff, Shift, StaffActivity
  - Super-admin seed script (`npm run seed:admin`)
  - Docker + Render + Railway deploy configs; production `npm start` path-alias fix
  - [Deployment guide](DEPLOYMENT.md) + [Production checklist](PRODUCTION_CHECKLIST.md)
- [ ] **Phase 7 — Frontend apps (admin / kitchen / customer)** — _in progress_
  - [x] Customer app: QR resolve → menu browse → cart → **auth** → **checkout
        (coupon + COD/Razorpay)** → **live order tracking (Socket.io)**
  - [x] **Kitchen Display System**: staff login (secret code), live order-queue
        board, full lifecycle actions, new-order sound + Socket.io
  - [x] **Admin dashboard (pass 1)**: admin login, overview metrics, kitchens
        (+owner provisioning), rooms & QR (generate/download/disable/reassign)
  - [x] **Admin dashboard (pass 2a)**: menu (categories/items, stock, image upload,
        scheduled availability), orders (lifecycle, cancel, refunds, internal notes)
  - [x] **Admin dashboard (pass 2b)**: coupons, analytics (charts + CSV/Excel/PDF
        export), audit-log viewer (+ new backend `GET /audit` endpoint)
        (Next.js 15, Tailwind, React Query, Zustand, RHF/Zod; `next build` passes, 23 routes)

> **All apps feature-complete:** backend **82 tests** green; three frontends
> (customer / kitchen / admin) typecheck clean and build (23 routes).

> **Backend status:** feature-complete and tested — **79 passing tests**,
> `tsc --noEmit` clean, production build verified. See
> [`backend/README.md`](backend/README.md) for the full API.
> **Frontend status:** customer app foundation building — see
> [`frontend/README.md`](frontend/README.md).

See [`backend/README.md`](backend/README.md) for setup and the API.
