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
- Sign up as a homeowner → subscribe ($20/mo) → roster unlocks.
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
