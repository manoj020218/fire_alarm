# FireGuard × Billing Platform — Wiring Plan

> **Goal:** self-serve signup → 3-month free trial → FireGuard dashboard login, with the iotsoft.in
> billing platform tracking the subscription (trial → **annual, per monitored device**) for later
> invoicing. Prices are NOT shown publicly — set internally in the plan, quoted after trial.
> Reuses the EdgeFolio licensing machinery already on the billing platform.

Two systems:
- **Billing platform** — `D:\IOT Device\Billing at IOT soft\billing-server` (live: iotsoft.in, PM2
  `billing-platform`, port 3010, Mongo). Owns subscriptions/invoices/payments.
- **FireGuard backend** — `fireguard v1\VPS\backend` (live: fireguard.iotsoft.in/api, PM2
  `fireguard-api`, port 4070, Mongo `fireguard`). Owns the actual user accounts, sites, devices.

## Shared bridge contract (secret `FIREGUARD_BRIDGE_SECRET` in BOTH .env; header `X-Bridge-Secret`)

**Billing → FireGuard — provision an org+admin on signup:**
`POST https://fireguard.iotsoft.in/api/bridge/provision`
body `{ orgName, adminName, adminEmail, phone, trialEndsAt (ISO) }`
→ 200 `{ ok:true, siteId, adminEmail, tempPassword, loginUrl:"https://fireguard.iotsoft.in/app" }`
(creates a Site + a CLIENT_ADMIN User with a random temp password; sets Site.subscription = trial,
Site.trialEndsAt. Idempotent-ish: if adminEmail exists → 409.)

**FireGuard → Billing — report device usage for invoicing:**
`POST https://iotsoft.in/api/fireguard/usage`
body `{ siteId, deviceCount, gatewayCount }` → 200 `{ ok:true }`
(billing finds the client by productEntityId=siteId, stores deviceCount for the per-device invoice.)

## Part A — Billing platform (reuse EdgeFolio pattern; READ billing-server/src: seeds/seedEdgefolio.js, controllers/edgefolio.controller.js, superadmin.edgefolio.controller.js, routes/*edgefolio*, models/Client.js, services/edgeLicense.service.js, index.js mounting)
1. **Seed `fireguard` product** (`seeds/seedFireguard.js`, idempotent) — name "FireGuard", slug
   `fireguard`, unitLabel "Device", clientLabel "Site".
2. **Plan config** — a FireGuard plan record (in platform_plans or a constant): billingModel
   `per_unit_annual`, trialDays 90, pricePerUnitPaise (placeholder e.g. 0 / TBD — money in PAISE),
   unit "device". (Prices internal only.)
3. **Public signup** `POST /api/fireguard/signup` (`controllers/fireguard.controller.js`,
   `routes/fireguard.routes.js`, mounted `/api/fireguard` in index.js + added to SPA-exclusion list):
   body `{ companyName, contactName, phone, email }` (validate). Steps:
   a. Reject if an unexpired trial/active client already exists for this phone OR email.
   b. Create platform_client (productId=fireguard, ownerName/Phone/Email, status `trial`,
      trialEndsAt=+90d).
   c. Call the FireGuard provision bridge → `{ siteId, adminEmail, tempPassword, loginUrl }`.
   d. Save `client.productEntityId = siteId`.
   e. Return `{ ok, email, tempPassword, loginUrl, trialEndsAt }`. Wrap the bridge call so a failure
      rolls back / marks the client provisioning-failed (don't leave a half-created client).
4. **Usage ingest** `POST /api/fireguard/usage` (X-Bridge-Secret) — find client by
   productEntityId, update `deviceCount` + `lastUsageAt`.
5. **Superadmin** `superadmin.fireguard.controller.js` + routes (superAdminAuth, mounted
   `/superadmin/fireguard`, added to SPA-exclusion): list clients (company, contact, status,
   trialEndsAt, deviceCount, createdVia) ; extend/convert-to-active (set status active + start annual
   period) ; suspend/unsuspend. Reuse the invoice-confirm hook pattern to convert trial→active.
6. env: `FIREGUARD_BRIDGE_SECRET`, `FIREGUARD_API_BASE=https://fireguard.iotsoft.in/api` (+ .env.example).

## Part B — FireGuard backend (`VPS/backend`; follow its existing patterns — Zod, controllers, routes, AuditLog, tests; READ src/app.ts, models/Site.ts, models/User.ts, services/auth.service.ts, middleware/*)
1. **Site subscription fields** (models/Site.ts): `subscription` enum `trial|active|suspended|expired`
   (default trial), `trialEndsAt`, `graceDays` (default 15), `deviceLimit?` (null=unlimited),
   `billingClientId?`.
2. **Bridge middleware** `middleware/bridgeAuth.ts` — constant-time check of `X-Bridge-Secret`
   against env `BRIDGE_SECRET`.
3. **Provision endpoint** `POST /api/bridge/provision` (bridgeAuth): create Site (siteId generated,
   name=orgName, subscription trial, trialEndsAt) + CLIENT_ADMIN User (random temp password, must-
   change flag optional), audit it, return `{ ok, siteId, adminEmail, tempPassword, loginUrl }`.
   409 if adminEmail already exists.
4. **Subscription state** helper + a light gate: compute trial/active/expired from
   subscription+trialEndsAt+graceDays. Add a `GET /api/subscription` (auth) returning the caller
   site's status + daysLeft for a dashboard banner. Enforcement: when expired (past trial+grace and
   not active) → block WRITE/management routes (add device, edit config) with a clear
   `SUBSCRIPTION_EXPIRED` 402/403, but NEVER stop telemetry ingest / alarm delivery (safety) and keep
   read access. Show renewal notice in the app.
5. **Usage reporting job** `services/usageReporter.ts` — daily (+ on boot after delay): per Site,
   count alarm-capable Devices (and gateways) → `POST {BILLING_BASE}/api/fireguard/usage` with
   X-Bridge-Secret. Best-effort, never crash.
6. env: `BRIDGE_SECRET`, `BILLING_BASE=https://iotsoft.in`, `APP_LOGIN_URL=https://fireguard.iotsoft.in/app`.
7. Integration tests: provision (valid secret 200, bad secret 401, dup email 409), subscription
   state transitions, usage-reporter payload shape.

## Part C — Signup UI + marketing CTA (after A+B green; small)
- A signup form (on fireguard.iotsoft.in/app/signup, or a section on the marketing page) → POST
  iotsoft.in/api/fireguard/signup → show the returned tempPassword + "Login" link to /app.
- Point marketing "Create account"/"Start free" buttons at the signup.

## Verify / deploy
- Build + tests green on both repos locally. Deploy billing (pscp + pm2 restart billing-platform)
  and fireguard-api (rebuild + pm2 restart fireguard-api) with the shared BRIDGE_SECRET set. Test:
  curl the signup → confirm a FireGuard login is created and works at /app.
- Prices stay internal (placeholder in plan). No public price disclosure.
