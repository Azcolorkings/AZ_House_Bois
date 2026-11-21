# AZ House Bois — deploy guide

Next.js 15 marketplace app. Public marketing site + accounts + two
$20/month Stripe subscriptions (homeowners browse the roster, bois list
themselves). Code lives in `~/workspace/az-house-bois-app/`.

## Status

- ✅ App builds clean (`npm run build`) and smoke-tested locally
  (home/pricing/login/signup 200, /roster redirects to login when signed
  out, /api/checkout returns 401 without a session, no server errors).
- ⛔ **Deployment is BLOCKED on Vercel team-scope authorization.**
  The Vercel identity is connected, but API calls fail with 403:
  `Not authorized: Trying to access resource under scope
  "stevendrice2992-4340". You must re-authenticate to this scope.`
  Team ID: `team_r97HSo6WJ3iOXw5XKrl2dYBC`. The API's prescribed fix
  (`authorize_team_access`) is not available in the reviewed Vercel
  tools, and a fresh `authorize-url` is refused while the connector is
  connected. The user must grant the team scope at the connector page:
  **https://agent.meta.ai/connectors/connect/vercel**
  Do NOT disconnect the connector to work around this unless the user
  asks — disconnect deletes the stored connection.
- ⛔ **Stripe: do NOT create products yet.** The connected account
  `acct_1UZKnkGk1jYd9wEx` (named "linktr.ee") is the WRONG account,
  and the Stripe connector is currently reporting "not connected;
  reconnect required" (the user is switching to the separate AZ House
  Bois account). When the correct account lands, re-check
  `list_available_accounts_or_orgs` and use that account. The app uses
  `STRIPE_PRICE_CLIENT` / `STRIPE_PRICE_BOI` placeholders — checkout
  refuses with a clear "subscriptions are not open yet" message until
  real price IDs are set.

## Resume deployment (once team access is granted)

Payload is ready in `~/workspace/az-house-bois-app/`. Manifest with
SHA1 + sizes: `deploy-manifest.json` (33 files; text files ~73 KB;
images ~1.76 MB total). Also include `package-lock.json`
(53,881 bytes, sha1 `da1b2e929dfd6dc9ebaaa563538470600dc6f3c2`).

1. Create the project (MCP `create_project`): name `az-house-bois`,
   team scope `stevendrice2992-4340`. Do NOT create the project under a
   different team.
2. Upload the 3 images with MCP `upload_file` (base64), noting each
   returned SHA1:
   - `public/images/hero-home.webp` (550,700 bytes, sha1 `6a81a3d268f8cd34d71cfe7e03b74207362f139d`)
   - `public/images/kitchen.webp` (464,344 bytes, sha1 `7e88beda5d3766184722837843e21cf354731bf4`)
   - `public/images/pool.webp` (746,978 bytes, sha1 `00b156af676ab722aaea7833be2049ccdd7a7c06`)
3. `create_deployment` with `requestBody.name = "az-house-bois"` and
   `requestBody.files`: every text file inlined (`encoding: "utf-8"`),
   the 3 images referenced by `{ file, sha, size }`, plus
   `package-lock.json` inlined. Exclude `node_modules/`, `.next/`,
   `.env*`.
4. Poll `get_deployment` until READY, then verify the returned URL
   with `web_fetch_vercel_url` or curl (home page must contain
   "Spotless house").
5. Set the env vars from section 3 below (project settings or
   `create_project_env`) and redeploy.

## 1. Reconnect Vercel

User opens https://agent.meta.ai/connectors/connect/vercel and signs in
as azcolorkingssteven-9073.

## 2. Create the project + database

Option A — from this workspace (after reauth), via the Vercel MCP
`create_deployment` tool with the project source in
`~/workspace/az-house-bois-app/`. Create the project as `az-house-bois`
under the user's team/account.

Option B — Vercel CLI: `cd ~/workspace/az-house-bois-app && vercel`
and follow the prompts (link to azcolorkingssteven-9073, project
`az-house-bois`).

Database: in the Vercel dashboard, add a Postgres database to the
project (Vercel Marketplace → Neon Postgres, free tier). Vercel injects
`POSTGRES_URL` (or `DATABASE_URL` — the app mirrors it) automatically.
Tables are created on first use by the app itself (`ensureSchema()` in
`src/lib/db.ts`); no manual migration step.

## 3. Environment variables (Vercel project settings)

| Variable | How to get it |
|---|---|
| `POSTGRES_URL` | Auto-injected when the Postgres database is linked (or `DATABASE_URL` from the Neon integration). |
| `AUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | From the **correct AZ House Bois** Stripe account (Dashboard → Developers → API keys, secret key). Supply via the secure vault flow — never paste raw keys in chat. |
| `STRIPE_WEBHOOK_SECRET` | After creating the webhook endpoint in Stripe (see step 4). |
| `STRIPE_PRICE_CLIENT` | `price_1Udv0xCuX2Dc2d82luX34BmI` — $20/month homeowner membership, created 2026-11-20 on the AZ House Bois account (acct_1UduowCuX2Dc2d82). |
| `STRIPE_PRICE_BOI` | `price_1Udv0xCuX2Dc2d82PcrJlNLu` — $20/month boi listing, created 2026-11-20 on the AZ House Bois account (acct_1UduowCuX2Dc2d82). |
| `NEXT_PUBLIC_APP_URL` | The deployed URL, e.g. `https://az-house-bois.vercel.app` |
| `ADMIN_EMAIL` | Email allowed to review cleaner applications at `/admin/applications` (approve/deny, sees decrypted SSNs for 1099 filing). Defaults to `stevendrice2992@gmail.com` if unset. |

## 3b. Cleaner application flow (added 2026-11-21)

Cleaners (bois) apply before they can list or pay anything:

1. Sign up as a boi → sent to `/apply` (homeowners still go to `/pricing`).
2. Application form: full legal name, date of birth, address, phone, SSN
   (encrypted at rest with AES-256-GCM, key derived from `AUTH_SECRET` —
   never stored or logged in plaintext), emergency contact, cleaning
   experience, availability, service areas, profile photo, and a photo ID
   upload ("Upload your ID").
3. The cleaner reads and signs the Independent Contractor Agreement
   (text in `src/lib/agreement.ts`): no fraternizing with clients, strictly
   cleaning, 1099 contractor not employee, paid biweekly after the company
   gets paid. Signature = typed full legal name + date + checkbox.
4. **The $20/month listing fee is stated up front on the application page
   and in the agreement** — cleaners pay nothing to apply and nothing until
   approved, so nobody is surprised by the fee later.
5. Status starts as `pending`. Steven reviews at `/admin/applications`
   (gated to `ADMIN_EMAIL`) and approves or denies each one. Denied
   cleaners can re-apply; re-applying resets the status to pending.
6. Only AFTER approval can a cleaner start the $20/month boi subscription
   (`/api/checkout` and `/api/listings` both enforce this server-side) and
   create/publish a listing. Clients are unaffected.
7. Tables: `applications` is auto-created by `ensureSchema()` in
   `src/lib/db.ts` like `users` and `listings`. No manual migration.

## 3c. Homeowner agreement & waiver (added 2026-11-21)

Homeowners sign before they can see the roster or subscribe:

1. New homeowners read and sign the agreement on the signup page itself
   (text in `src/lib/homeowner-agreement.ts`): the job is cleaning only,
   AZ House Bois is NOT responsible for broken/damaged items while cleaners
   are on duty, zero-tolerance no sexual harassment (breaking it ends the
   account at once, the cleaner leaves and it gets reported), payment goes
   through AZ House Bois ($20/month membership, never pay a cleaner on the
   side), 18+. Signature = typed full name + checkbox.
2. The signed text, signature, and timestamp are stored on the `users`
   record (`homeowner_agreement_text/signature/signed_at` — added by
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `ensureSchema()`, so
   existing deployments pick it up with no manual migration). The signed
   copy never changes if the text is later edited.
3. Homeowners who created their account before the agreement existed sign
   it from their dashboard instead (`/api/homeowner-agreement` + the
   dashboard agreement card) — the gates below catch them either way.
4. Server-side enforcement, not just UI: `/api/checkout` refuses client
   checkout without a signature (403, code `homeowner-agreement-required`)
   and `/api/roster` refuses unsigned homeowners (403, same code); the
   roster page also redirects unsigned homeowners to sign on the dashboard.
5. The dashboard shows a homeowner their signed status (name + date) or
   the sign form when unsigned. The cleaner flow is untouched.

## 4. Stripe setup (correct account only)

1. Confirm the account with `list_available_accounts_or_orgs` — it must
   be the AZ House Bois account, NOT `acct_1UZKnkGk1jYd9wEx`.
2. Create two recurring products, each $20/month:
   - Homeowner membership → `STRIPE_PRICE_CLIENT`
   - Boi listing → `STRIPE_PRICE_BOI`
3. Create a webhook endpoint pointing at
   `https://<your-domain>/api/webhooks/stripe`, subscribing to
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
4. Never charge anything while testing — use the live prices only once
   the account is confirmed.

## 5. Verify after deploy

- Home page loads with the hero, looks picker, checklist, membership
  cards, areas, FAQ.
- Sign up as a homeowner → the homeowner agreement & waiver is on the
  signup page (sign it there) → subscribe ($20/mo) → roster unlocks.
- Unsigned homeowners (accounts made before the agreement) get a 403 from
  `/api/checkout` and `/api/roster` until they sign on the dashboard.
- Sign up as a boi → subscribe → dashboard listing editor appears →
  publish → listing shows on the roster.
- Cancel from the dashboard (Customer Portal) → status updates via webhook.

## Known notes

- `@vercel/postgres` is deprecated in favor of Neon's SDK, but it still
  works and is what this app uses; the Neon Vercel integration is the
  provisioning path.
- `next build` prints Edge-runtime warnings about `jose` using
  CompressionStream in middleware. They are non-fatal warnings; the
  build passes and the middleware redirect was verified locally. If
  runtime auth errors ever appear, the fallback is to delete
  `src/middleware.ts` — every protected page also checks the session
  server-side.
- No business address, phone number, or contact email is invented
  anywhere in the app. No testimonials or people are invented — the
  roster starts empty until real bois publish listings.
