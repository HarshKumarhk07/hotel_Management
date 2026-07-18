# KDS Frontend

Next.js 15 (App Router) + TypeScript + Tailwind + React Query + Zustand. One
workspace, three experiences:

- **`(customer)`** — mobile-first guest ordering (scan → order → track)
- **`/kitchen`** — full-width live Kitchen Display System for staff
- **`/admin`** — Super Admin dashboard (sidebar shell)

## Quick start

```bash
cd frontend
cp .env.example .env.local      # set NEXT_PUBLIC_API_URL to your backend
npm install
npm run dev                     # http://localhost:3000
```

The backend must be running (see [`../backend/README.md`](../backend/README.md))
and the frontend origin must be in the backend's `CORS_ORIGINS`.

## The flow (implemented so far)

```
Scan QR  →  /r/<token>            resolve room+kitchen (server) → redirect
         →  /k/<kitchenId>?room=  browse menu, add to cart (Zustand, persisted)
         →  cart sheet            quantities, live totals → "Proceed to checkout"
```

- **`/`** — landing / scan prompt
- **`/r/[token]`** — server component; calls `GET /rooms/resolve/:token`, then
  redirects to the kitchen menu with room context (no manual room entry)
- **`/k/[kitchenId]`** — menu: category chips, veg/non-veg/Jain labels,
  featured/recommended badges, add-to-cart with quantity steppers, sticky cart bar
- **Cart** — client-side ([`stores/cart.ts`](src/stores/cart.ts)), persisted to
  localStorage, auto-resets when a different kitchen QR is scanned. Prices here are
  a UX preview only — the **server recomputes authoritative totals at checkout**.

## Architecture

```
src/
├── app/
│   ├── layout.tsx          root layout + providers (React Query)
│   ├── page.tsx            landing
│   ├── r/[token]/          QR resolve → redirect
│   └── k/[kitchenId]/      kitchen menu
├── components/
│   ├── ui/                 button, primitives (card, badge, food label, spinner)
│   ├── menu/MenuItemRow    item row with add/qty controls
│   └── cart/CartSheet      slide-up cart with totals
├── hooks/useMenu.ts        React Query menu fetch
├── lib/
│   ├── api.ts              axios + silent refresh-token interceptor
│   ├── types.ts            API response types
│   └── utils.ts            cn() + INR formatter
└── stores/cart.ts          Zustand cart (persisted)
```

The [API client](src/lib/api.ts) keeps the access token in memory and silently
refreshes via the HttpOnly cookie on a 401, then retries — matching the backend's
rotation scheme.

## Auth, checkout & tracking (implemented)

- **Auth** — email/password login + register (RHF + Zod), email verification,
  forgot/reset password, and Google sign-in (GIS, if a client id is set). The
  session bootstraps on load via a silent refresh + `/auth/me`; `AuthGate` guards
  customer-only pages and redirects to `/login?next=…`.
- **Checkout** (`/checkout`, auth-gated) — pushes the client cart to the **server
  cart** (which recomputes authoritative prices), applies a **coupon** via
  `/coupons/validate`, and places the order with **COD** or **Razorpay**. The
  Razorpay flow opens the widget, then verifies the callback **signature** before
  the order counts as paid; dismissing marks the attempt failed (retryable).
- **Order tracking** — `/orders` (history) and `/orders/[id]` (animated status
  timeline + bill + payment/refund state). Updates **live over Socket.io**
  (`order:updated`, `payment:updated`, `refund:updated`) with a polling fallback.
  Pending Razorpay orders show a **Retry payment** button.

## Kitchen Display System (`/kitchen`)

Staff sign in at **`/kitchen/login`** with email + password + **kitchen access
code** (the backend's privileged secret-code gate). The board:

- **Live order queue** as columns: New → Accepted → Preparing → Ready → Out for
  delivery. Cards show room, items (with veg/non-veg/Jain labels), elapsed time
  (flagged red when past the prep estimate), payment, and total.
- **Actions** drive the backend lifecycle: Accept / Reject, Start preparing, Mark
  ready, Out for delivery, Mark delivered, Cancel (with reason). Terminal orders
  drop off the board.
- **Real-time** via the `kitchen:<id>` Socket.io room: `order:new` plays a chime
  ([Web Audio](src/lib/sound.ts), primed by an "Enable sound" tap to satisfy
  autoplay rules) and refetches; `order:updated`/`cancelled` refetch. 15s polling
  backs it up.

## Admin dashboard (`/admin`)

Super Admin signs in at **`/admin/login`** (email + password + admin secret code).
Sidebar shell ([AdminShell](src/components/admin/AdminShell.tsx)) with overview +
the management sections.

- **Overview** — headline metrics from `/analytics/summary` (revenue, orders,
  pending/completed/cancelled, AOV).
- **Kitchens** — list; create a kitchen and **provision its owner account** in one
  dialog; activate/deactivate (cascades to the owner's login).
- **Rooms & QR** — list/create rooms (QR auto-generated); per-room QR dialog to
  **preview, download (PNG/SVG), regenerate, disable, and reassign** (token swap).
  Authenticated binary downloads go through a blob helper (Bearer token).

- **Menu** — pick a kitchen, manage **categories** (create/delete) and **items**
  (create/edit/delete, price/tax/prep, food label, featured/recommended, **stock
  toggle**, **Cloudinary image upload**, and **scheduled-availability windows**
  with a per-window weekday picker).
- **Orders** — filter by kitchen + status; table → **detail dialog** that drives
  the lifecycle (accept/reject, advance status), **cancels** (with reason),
  **processes refunds**, and adds **internal notes**.

- **Coupons** — list, create (fixed/percent with cap, min order, expiry, total &
  per-user limits), activate/deactivate, delete.
- **Analytics** — kitchen filter, summary cards, dependency-free revenue-trend &
  orders-by-hour bar charts, best-sellers + refund breakdown, and **CSV / Excel /
  PDF export** (authenticated downloads).
- **Audit log** — paginated, filterable table (by action / actor email).

## Build status

- [x] Customer: scan → browse → cart → auth → checkout (coupon, COD/Razorpay) → live tracking
- [x] Kitchen Display: staff login, live queue board, lifecycle actions, sound + Socket.io
- [x] Admin (pass 1): login, overview, kitchens (+owner), rooms & QR
- [x] Admin (pass 2a): menu (categories/items/stock/image/schedule), orders (lifecycle/cancel/refund/notes)
- [x] Admin (pass 2b): coupons, analytics charts + CSV/Excel/PDF export, audit log

**All three frontends are feature-complete.**

> `tsc --noEmit` clean · `next build` passes (23 routes).
