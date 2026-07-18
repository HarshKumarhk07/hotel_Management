# Deployment Guide

Deploy the KDS platform: **MongoDB Atlas** (database) → **Railway/Render** (backend
API + Socket.io) → **Vercel** (frontend, later phase). This guide covers the
backend, which is production-ready today.

---

## 1. Prerequisites (third-party accounts)

| Service | Purpose | What you need |
|---------|---------|---------------|
| MongoDB Atlas | Database (replica set → transactions) | Connection string |
| Railway **or** Render | Host the Node API | Account + this repo |
| Brevo | Transactional email | API key, verified sender |
| Razorpay | Payments | Key ID, Key Secret, Webhook Secret |
| Cloudinary | Menu images | Cloud name, API key/secret |
| Google Cloud | Google OAuth (optional) | OAuth client ID/secret |
| Vercel | Frontend (later) | Account |

---

## 2. MongoDB Atlas

1. Create a project → **free/shared cluster** (it is a replica set, which the app
   requires for multi-document transactions used by kitchens, coupons, and QR
   reassignment).
2. **Database Access** → add a user (strong password).
3. **Network Access** → allow your backend host. Railway/Render egress IPs are
   dynamic, so use `0.0.0.0/0` *only if* combined with the DB user + TLS, or use
   Atlas Private Endpoint / the platform's static-IP add-on for stricter setups.
4. Copy the **SRV connection string** and append the DB name:
   `mongodb+srv://USER:PASS@cluster.mongodb.net/kds?retryWrites=true&w=majority`

---

## 3. Generate secrets

```bash
# Run three times for the three secrets (each ≥ 32 chars):
openssl rand -base64 48
```

Use the outputs for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`.
Choose strong values for `ADMIN_SECRET_CODE` and `KITCHEN_SECRET_CODE` (the extra
login factor for privileged accounts).

---

## 4. Backend — Render (Blueprint)

The repo ships [`backend/render.yaml`](backend/render.yaml).

1. Render Dashboard → **New → Blueprint** → connect this repo.
2. Render reads `render.yaml` (rootDir `backend`, build `npm ci && npm run build`,
   start `npm start`, health check `/api/v1/health`).
3. Fill every `sync:false` env var in the dashboard (see [§6](#6-environment-variables)).
4. Deploy. First boot validates env (`src/config/env.ts`) and **refuses to start**
   if anything is missing — check logs if it exits immediately.

## 4-alt. Backend — Railway

The repo ships [`backend/railway.json`](backend/railway.json).

1. Railway → **New Project → Deploy from GitHub** → pick this repo.
2. Set **Root Directory** = `backend` (Settings → Service).
3. Railway uses Nixpacks: build `npm ci && npm run build`, start `npm start`.
4. Add the env vars, then **Generate Domain** (Settings → Networking).

## 4-alt. Backend — Docker (any host)

```bash
cd backend
docker build -t kds-backend .
docker run -p 5000:5000 --env-file .env kds-backend
```

The image is multi-stage, runs as a non-root user, and has a built-in
`HEALTHCHECK`.

---

## 5. Seed the first Super Admin

Registration only creates customers, so seed an admin once after the DB is live:

```bash
# Locally (pointing at the prod DB) or via a Render/Railway one-off shell:
SEED_ADMIN_NAME="Hotel Owner" \
SEED_ADMIN_EMAIL="admin@yourhotel.com" \
SEED_ADMIN_PASSWORD="Sup3r!Strong" \
npm run seed:admin
```

Log in with that email + password **and** the `ADMIN_SECRET_CODE`.

---

## 6. Environment variables

Copy [`backend/.env.example`](backend/.env.example). Required to boot:

| Var | Notes |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | platform-injected (Render/Railway) or `5000` |
| `MONGODB_URI` | Atlas SRV string incl. db name |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `COOKIE_SECRET` | each ≥ 32 chars |
| `ADMIN_SECRET_CODE` / `KITCHEN_SECRET_CODE` | privileged login factor |
| `APP_URL` | frontend origin (used in email links) |
| `API_URL` | this service's public URL |
| `CORS_ORIGINS` | comma-separated allowlist — **no wildcards** |

Feature integrations (degrade gracefully if omitted, but needed in prod):
`BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `SECURITY_ALERT_EMAIL`,
`RAZORPAY_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET`,
`CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`,
`GOOGLE_CLIENT_ID` / `_CLIENT_SECRET`.

---

## 7. Razorpay webhook

1. Razorpay Dashboard → **Settings → Webhooks → Add**.
2. URL: `https://<API_URL>/api/v1/payments/webhook`
3. Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`.
4. Subscribe to: `payment.captured`, `payment.failed`, `refund.processed`.
5. The endpoint verifies the HMAC over the **raw body** and is idempotent, so
   Razorpay retries are safe.

> The webhook route is intentionally mounted **before** auth/CSRF/rate-limiting
> and authenticates purely via signature.

---

## 8. Other integrations

- **Brevo** — verify your sender domain/address, create an API key (`BREVO_API_KEY`).
  Without a key, emails are logged instead of sent (fine for staging).
- **Cloudinary** — copy cloud name + API key/secret. Menu image uploads (5 MB,
  image MIME only) stream straight to the `kds/menu` folder.
- **Google OAuth** — create an OAuth client; authorised origins = your frontend;
  put the client ID/secret in env. The frontend sends the Google **ID token** to
  `POST /api/v1/auth/google`.

---

## 9. Frontend (Vercel) — later phase

When the Next.js apps land: import the repo into Vercel, set root to `frontend`,
add `NEXT_PUBLIC_API_URL=https://<API_URL>/api/v1` and the Google client ID, then
**add the Vercel domain to the backend's `CORS_ORIGINS`** and set `APP_URL` to it.

---

## 10. Post-deploy smoke test

```bash
curl https://<API_URL>/api/v1/health           # → { success:true, data:{ status:"ok" }}
# Swagger UI:
open https://<API_URL>/docs
```

Then: log in as the seeded admin → create a kitchen (+owner) → add a room (QR
auto-generated) → as the owner add a category + menu item → scan-resolve the QR
(`/api/v1/rooms/resolve/:token`) → place a COD order → advance its status.

See [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) before going live.
