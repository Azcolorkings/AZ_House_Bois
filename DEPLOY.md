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
| `RESEND_API_KEY` | Resend API key for admin email notifications (see 3d). Leave unset and the app works exactly as before — notifications just don't send. |
| `NOTIFY_EMAIL` | Who gets the notification emails. Optional; defaults to `stevendrice2992@gmail.com`. |

## 3d. Admin email notifications (added 2026-11-21)

Steven gets an email the moment someone signs up or a cleaner applies,
so he doesn't have to keep checking the admin page:

- New account → "New AZ House Bois signup — {email} ({Homeowner / Cleaner (boi)})"
- New cleaner application → "New cleaner application — {legal name}" with
  the applicant's name, email, phone, service areas, and a link to
  `/admin/applications`.

How it works: `src/lib/notify.ts` sends through **Resend** (`resend`
package). The helper is fail-soft by design — if `RESEND_API_KEY` is
missing or the send fails, it logs the error and returns; the signup or
application still succeeds. The calls run via Next.js `after()` so they
never delay the response. **No secrets in code** — the key lives only in
the Vercel env var.

Steven's setup steps (his step — the key is his Resend account):

1. Create a free account at https://resend.com with
   `stevendrice2992@gmail.com`.
2. Dashboard → API Keys → create an API key (any name, e.g. "AZ House Bois").
3. In Vercel (project `az-house-bois` → Settings → Environment
   Variables) add `RESEND_API_KEY` = the key, Production scope, and
   redeploy. `NOTIFY_EMAIL` is optional — it defaults to
   `stevendrice2992@gmail.com`.
4. Until the key is set, **nothing changes** — signups and applications
   work exactly as before, just without the emails.

Why the sender is `onboarding@resend.dev`: Resend's free tier lets you
send from that address with no verified domain, as long as the recipient
is the account owner's own email (which is why the default recipient is
Steven's Gmail). If a custom domain is ever verified, change the `from`
in `src/lib/notify.ts` and update this doc.

## 3e. 18+ enforcement (added 2026-11-21)

Both sides must be 18 or older. The agreement texts already said 18+;
now it is actually enforced:

- **Cleaners:** `POST /api/applications` parses the application's date
  of birth and rejects with a 400 if the applicant is under 18. The age
  math is in `src/lib/age.ts` (`isAtLeast18`) — month and day count, not
  just the birth year. The apply form (`ApplicationForm.tsx`) checks the
  same thing before submitting, but the server check is the real gate.
- **Homeowners:** signup never collected a date of birth before, so a
  DOB field was added to the homeowner agreement block
  (`HomeownerAgreementForm.tsx`), which is shown both on the signup page
  and on the dashboard sign form for older accounts. The DOB is stored on
  the `users` record (`dob` column, added with `ADD COLUMN IF NOT
  EXISTS` in `ensureSchema()`, same pattern as the agreement columns).
  `POST /api/signup` and `POST /api/homeowner-agreement` both reject
  with a 400 when the homeowner is under 18. Cleaners are NOT asked for
  a DOB at signup — their age is enforced at application time.
- Homeowners who signed the agreement before this change have no DOB on
  record; they are not re-checked. New signups and new signatures are.

## 3f. Booking & one-time cleaning payments (added 2026-11-21)

Homeowners book and pay for a clean at booking time; the boi confirms
from their dashboard:

**Prices (flat rates, set by Steven Nov 21, 2026):** Regular clean $180,
Deep clean $350, Move-in / move-out $450 — the same price no matter the
house size or frequency. The single source of truth is
`src/lib/pricing.ts` (`CLEANING_PRICES`, cents). Nothing else in the
app hard-codes a cleaning price, and `/api/bookings` re-derives the
price server-side — a client-sent amount is never trusted.

**The 20/80 split (decided Nov 21, 2026):** on every cleaning fee, AZ
House Bois keeps 20% and the cleaner gets 80% — Regular $36 / $144,
Deep $70 / $280, Move-in/out $90 / $360. The split is computed in
`splitAmount()` in `src/lib/pricing.ts` and stored on the booking row
(`company_amount_cents`, `cleaner_amount_cents`) at creation. The
cleaner is paid biweekly after the company gets paid — that timing is
in the contractor agreement (`src/lib/agreement.ts`, point 5, version
`2026-11-21-split`), not an automatic payout: there is no Stripe
Connect or automatic transfer in this build; Steven pays the bois out
of the Stripe balance on the biweekly schedule. `/admin/bookings` shows
the cleaner pay owed on confirmed cleans so he can see the total at a
glance.

**Flow:**

1. Homeowner (subscribed, agreement signed) picks a boi on the roster
   → "Book" goes to `/book/[listingId]`, which re-checks every gate
   server-side (client role, active subscription, signed agreement,
   listing published, boi approved + subscribed).
2. Booking form: service (with flat price), date (no past dates), time
   slot (8 AM / 10 AM / 12 PM / 2 PM / 4 PM), frequency (one-time /
   weekly / every 2 weeks / monthly — informational only), service
   address, notes, and an "I have my own cleaning supplies" checkbox.
   Unchecked = the boi brings his own supplies, per the agreement.
3. `POST /api/bookings` validates the same gates + the service/price,
   creates the booking as `requested`, then creates a Stripe Checkout
   session in **payment** mode for exactly that amount, metadata
   `{ type: "booking", booking_id }`, and returns the Checkout URL.
   The existing `/api/checkout` subscription route is untouched.
4. The webhook (`/api/webhooks/stripe`) checks `checkout.session.completed`
   for `metadata.type === "booking"` FIRST: it marks that booking paid
   (`paid_at` + payment intent id) and returns without touching
   subscription status. Subscription checkouts keep working exactly as
   before — they have no `type: "booking"` metadata. A booking paid
   after it was already cancelled is flagged `needs_refund` for a
   manual refund.
5. The boi sees paid requests on their dashboard with Accept (→
   `confirmed`) and Decline buttons. The homeowner sees their bookings
   with a Cancel button.
6. **Refunds:** declining a paid booking, or cancelling one that is
   still `requested`, attempts an automatic Stripe refund of the
   payment intent. If the refund fails, the booking is still declined /
   cancelled and flagged `needs_refund` — the admin refunds it by hand
   in Stripe and sees the flag on `/admin/bookings`. Cancelling a
   **confirmed** booking never auto-refunds; it is flagged
   `needs_refund` for the owner to handle manually.
7. **Refund permission caveat:** the live restricted key
   ("AZ House Bois Vercel") was created with Checkout Sessions /
   Customer Portal / Customers Write + Prices / Products / Subscriptions
   Read — it may not have the Charges permission refunds need. If
   refunds fail with a permission error, add **Charges: Write** to that
   key in the Stripe Dashboard (requires the authenticator code), or
   refund manually in Stripe. The code never crashes on a failed refund.

**Emails** (`src/lib/notify.ts`, same fail-soft pattern as signups):
Steven gets a new-booking email (client, boi, service, amount + split,
date/time, address, supplies flag); the boi gets a request email
including their 80% pay for the clean; the homeowner gets an email on
confirm/decline. All run via `after()` so they never delay a response.
Note the free-tier limit: Resend only delivers mail sent from
`onboarding@resend.dev` to the Resend account owner's own email, so
boi/homeowner mail will be rejected by Resend until a domain is
verified in Resend and the `from` in `notify.ts` is changed — the
failure is logged and the booking still succeeds.

**Tables:** `bookings` is auto-created by `ensureSchema()` in
`src/lib/db.ts` (plus `ADD COLUMN IF NOT EXISTS` for the split columns,
same pattern as the agreement columns). Status: `requested` →
`confirmed` / `declined` / `cancelled`; `completed` exists for later
use. `paid_at` marks payment; `refund_status` is `none` /
`not_required` / `refunded` / `failed`.

**Admin:** `/admin/bookings` (gated to `ADMIN_EMAIL`, same pattern as
`/admin/applications`) lists every booking with client email, boi name,
service, total / company 20% / cleaner 80%, date, status, and paid /
refund flags.

## 3g. Founding-boi offer — first month free (added 2026-11-21)

The first 5 approved bois get their first month free, then $20/month
(decided by Steven Nov 21, 2026, to seed the roster):

- **Coupon (already exists — do NOT create another one):** Stripe
  coupon `founding-boi-free-month`, live mode, 100% off, duration
  `once`, max 5 redemptions, restricted to the Boi Listing product
  (`prod_VfFVCzV9OHUfLY`). `times_redeemed` was 0 when wired in.
- **Gating (in `POST /api/checkout`, boi role only):** before creating
  the subscription-mode Checkout Session, the route checks the boi's
  application is approved (existing gate) and that
  `countFoundingFreeUsed() < 5`. If both hold, the session is created
  with `discounts: [{ coupon: "founding-boi-free-month" }]`. The
  coupon is NEVER attached to a homeowner/client checkout.
- **Usage tracking:** `users.founding_free_used` (added with
  `ADD COLUMN IF NOT EXISTS` in `ensureSchema()`, same pattern as the
  `dob` column) means "this boi used one of the 5 free months".
  `countFoundingFreeUsed()` counts boi users with the flag set.
  **Fixed Nov 22, 2026 — the flag used to be set the moment the
  Checkout Session was created, so an abandoned checkout burned a
  spot (the live test proved it: a test boi abandoned checkout and
  the count dropped to 4 of 5 with no subscription). Now the coupon
  session carries `founding_free=1` in its metadata (and in
  `subscription_data.metadata`, so the subscription carries it too),
  and `markFoundingFreeUsed(userId)` is called ONLY from the webhook
  on `checkout.session.completed` or `customer.subscription.created`
  with that metadata — i.e. only once the subscription actually
  exists. The UPDATE is idempotent, so both events firing or a
  duplicate delivery can never burn two spots. A boi who already
  used one does not get another. LIVE-DATA NOTE: the test boi's flag
  was already burned by the old code before this fix, so the count
  still shows 4 of 5 until that flag is reset (one-off SQL on Neon).
  Steven chose Nov 22 to leave the subscription test for a real boi
  to prove, so the reset is the only way back to 5 of 5 — and with
  the flag set, the checkout route will NOT offer the test boi the
  coupon again on retry.**
- **Fallback:** if Stripe rejects the coupon (e.g. max redemptions
  already hit), the route logs the error and falls back to a plain
  checkout with no coupon — the boi can still subscribe; the free
  month is a bonus, never a blocker. The plain fallback session
  carries NO `founding_free` metadata, so completing it never burns
  a spot. The webhook needs no change: a
  100%-off first invoice still fires `checkout.session.completed` and
  the subscription is marked active as usual.
- **Site copy:** a shared server component
  (`src/components/FoundingOffer.tsx`) reads the live remaining count
  and shows "Founding offer: the first 5 approved bois get their
  first month free, then $20/month" plus "N of 5 founding spots
  left". It renders nothing once all 5 are used, and it is only ever
  rendered on boi-facing surfaces: the `/apply` page, the boi card on
  `/pricing`, and the boi dashboard Membership card (approved but not
  yet subscribed). Never on the homeowner side.
- **Coupon constants:** `FOUNDING_COUPON_ID` and
  `FOUNDING_FREE_SPOTS` live in `src/lib/pricing.ts` next to the
  cleaning prices. The cleaner agreement text is unchanged — the free
  month is a promo, not an agreement change.

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
- Booking: as a subscribed homeowner, roster → Book → pick a service,
  date, time, address → pay the flat rate in Stripe Checkout (payment
  mode) → land back on the dashboard with the booking listed. The boi
  sees the paid request on their dashboard and can accept or decline;
  declining refunds the payment. `/admin/bookings` lists every booking
  with the total / company 20% / cleaner 80% split.
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

### 3h. Roster profiles: experience, service areas, application photo

- On approval (`POST /api/admin/applications`, approve only), the boi's listing is prefilled as an **unpublished draft** from their application: experience + service areas + profile photo copied over, display name = legal name, city = first service area matching a known roster city (else Phoenix), looks default `["Classic Boi"]`, availability copied, bio left blank for the boi to write. Prefill runs in try/catch and can never block the approval itself.
- If a listing already exists it is **never overwritten** — only the application photo is backfilled when the listing has none, so the boi's edits always win.
- Listing form (`ListingForm.tsx`): editable Cleaning experience textarea + Service areas input, prefilled from the listing. Photo section previews the effective photo ("Showing your application photo" vs "Showing your photo URL"); the URL field is an override — leave empty to keep the application photo, clear it to go back to it.
- Roster card shows service areas as pills under the city, an **Experience:** line when present, and the effective photo (pasted URL wins, else application photo, else the placeholder).
- Booking page uses the same effective-photo rule so the card and booking page match.
- Privacy: only experience, service areas, and the profile photo ever carry from the application to a listing/roster card. SSN, ID upload, address, emergency contact, and legal name are never shown on a profile.
- `listings` gains `experience`, `service_areas`, `photo_data` columns via `ADD COLUMN IF NOT EXISTS` in `ensureSchema()` (same pattern as earlier tables).
- Unproven until the first real application is approved: the full approve → prefilled draft → boi edits → roster card path, and the first-run migration on live Neon.

### 3i. Admin dashboard: all accounts, free admin roster view, suspend

- **`/admin`** — one dashboard listing every account in two sections: Clients (homeowners) and Bois. Each row shows email, display name where known, role, subscription status, date joined. Client rows also show whether the homeowner agreement is signed; boi rows also show application status (none/pending/approved/denied) and whether their listing is published. Counts at the top: total / clients / bois / paying / suspended. Linked from `/admin/applications` and `/admin/bookings`, and links back to both plus the roster.
- **Free admin roster view** — the admin (isAdminEmail) bypasses the roster gates in both the roster page server component and `GET /api/roster`: no client role, agreement, or $20/mo subscription needed to browse. Nobody else's gate changed. **Booking still requires a paid subscription, admin included** — the booking page was not touched.
- **Suspend / unsuspend** — `users.suspended` (BOOLEAN NOT NULL DEFAULT FALSE, via `ADD COLUMN IF NOT EXISTS` in `ensureSchema()`). Admin-only `POST /api/admin/users` `{ id, suspended }` toggles it; the admin account itself can never be suspended. Suspended users cannot sign in (`authorize` returns null) and their live sessions are killed by the session callback in `src/lib/auth.ts`, which re-checks the DB on every `auth()` call and strips the session user when suspended (fails open if the DB check errors, so a DB outage never locks everyone out). Middleware also bounces sessions with no user to `/login`. Suspending never deletes anything and never touches Stripe.
- Privacy: the dashboard shows email + status fields only. SSN, ID uploads, addresses, emergency contacts, DOBs, and passwords never appear on it.
- Unproven until the next deploy serves a request: the first-run `suspended` migration on live Neon, and the full suspend → locked-out → unsuspend path with a real account.

### 3j. Admin login page + admin navigation

- **`/admin/login`** — a separate admin sign-in page, deliberately distinct from the regular `/login` (dark header, "AZ House Bois — Admin" heading). Email + password only; no sign-up link, no role picker, no boi registration anywhere on it. Signs in through the same credentials auth. After sign-in the form checks `GET /api/admin/me` (server-side `isAdminEmail` check, so the admin email never leaks to the client): admins go to `/admin`, anyone else is signed straight back out with "This login is for the site admin only." Already-signed-in admins visiting `/admin/login` redirect to `/admin`.
- **Middleware fix** — `/admin` and its subpaths are protected, which would have made `/admin/login` unreachable. `src/middleware.ts` now exempts exactly `/admin/login` (public); every other `/admin/*` route stays protected and still redirects unauthenticated users to `/login`.
- **`/admin` nav cards** — four prominent cards at the top: Roster (`/roster`), Applications (`/admin/applications`), Homeowners (`/admin#clients`), Bookings (`/admin/bookings`). The clients and bois sections in `AdminUserList.tsx` now carry `id="clients"` / `id="bois"` anchors. Nothing was removed from the dashboard.
- **`/dashboard` admin section** — when the signed-in user is the admin, a card appears at the top with links to Admin dashboard, Roster, Cleaner applications, Homeowners (`/admin#clients`), and All bookings. Non-admin users see no admin section at all.
- Regular `/login` and `/signup` are untouched. Stripe, checkout, webhook, pricing, booking, agreements, and the $20/mo flows are untouched.
- Unproven until the next deploy serves a request: the new `/admin/login` route live, the non-admin rejection path, and the middleware exemption.

### 3k. Admin Analytics section on /admin

- **Analytics cards at the top of `/admin`** (admin-gated like the rest of the dashboard — `isAdminEmail` only, same server-component gate). All counts come from the existing Postgres tables via a new `getAdminAnalytics()` helper in `src/lib/db.ts`; no new external service, no Stripe API calls, no new dependencies.
- **Accounts:** total, clients vs bois, new signups in the last 7 and 30 days, suspended count. **Applications:** pending / approved / denied. **Subscriptions:** paying (active) vs not subscribed yet (`subscription_status = 'none'`). **Listings:** published vs unpublished drafts. **Bookings:** counts by status (requested / confirmed / declined / cancelled / completed) plus money — total of paid bookings (`paid_at IS NOT NULL`), company 20% cut earned on paid bookings, cleaner 80% pay owed on confirmed/completed cleans (same definition as the `/admin/bookings` total). **Founding offer:** spots left = 5 − `countFoundingFreeUsed()`, the same counter the site copy uses.
- **Signups — last 14 days:** per-day counts grouped from `users.created_at` in the America/Phoenix timezone, with zero-signup days filled in; oldest day first.
- Money is formatted with the existing `formatCents()` from `src/lib/pricing.ts`. Existing dashboard content (account lists, suspend switches, nav cards) is unchanged below the Analytics section.
- Unproven until the next deploy serves a request: the section rendering live with real data.

### 3l. Admin delete account + reopen founding spots (added 2026-11-22)

- **Delete account** — every account card on `/admin` (in `AdminUserList.tsx`) now has a Delete button next to Suspend/Unsuspend. Two-click confirm (first click arms it, second click deletes) since deleting is permanent. It calls `POST /api/admin/users/delete` `{ id }` (admin-gated to `isAdminEmail`, same as the suspend route) which refuses the admin account itself with 400. The `deleteUser()` helper in `src/lib/db.ts` deletes dependent rows first — bookings where the user is client or boi, then their application and listing — before deleting the user row, so nothing is orphaned (the tables also carry `ON DELETE CASCADE` as a backstop). Never touches Stripe — a deleted user's Stripe customer/subscription is left alone. On success the card disappears from the list in place.
- **Reopen all 5 founding spots** — a button in the Founding offer analytics card on `/admin` (`FoundingResetButton.tsx`, two-click confirm). It calls `POST /api/admin/founding-reset` (admin-gated), which runs `resetFoundingFreeUsed()` in `src/lib/db.ts`: `UPDATE users SET founding_free_used = FALSE WHERE founding_free_used = TRUE`. Added because a test account burned one spot and the owner wants all 5 free months available again. Never touches Stripe — the coupon's own `max_redemptions: 5` is the hard cap on Stripe's side and is unchanged. After a successful reset the card reads "5 of 5 founding spots left".
- Signup, login, checkout, webhook, pricing, booking, agreements, and the $20/mo flows are untouched.
- Unproven until the next deploy serves a request: deleting a real account end to end, and the founding reset clearing the flag live.
