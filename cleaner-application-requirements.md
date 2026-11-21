# Cleaner application + contractor agreement — requirements (Steven, Nov 20, 2026, 11:50 PM)

When a cleaner (boi) creates an account on AZ House Bois, signup must also collect a job application and a signed agreement before they can list. Clients are unaffected.

## Application fields (for 1099 contractor status)
- Full legal name
- Date of birth
- Address
- Phone
- SSN or EIN (for 1099) — handling TBD, see open questions
- Emergency contact
- Cleaning experience
- Availability
- Service areas
- Profile photo

## Agreement / waiver (signed by the cleaner, type name + date)
- Will not fraternize with clients
- Fully understands the job/role: strictly cleaning
- 1099 contracted worker, not an employee
- Paid after the company gets paid, biweekly

## Open questions — ANSWERED Nov 20, 11:53 PM
1. SSN handling — ANSWERED: put the SSN in the form AND have them upload it (upload = a document; confirm whether ID or W-9 at build review).
2. Order — ANSWERED: the $20 comes AFTER the application, so a cleaner can be approved or denied and doesn't get ripped off for their money. Flow: create account → application (with SSN + upload) → sign agreement → review approve/deny → if approved, pay $20/mo to list.

## Added Nov 21, 12:30 AM
- The application must make cleaners aware UP FRONT that there is a $20/month subscription fee to list (charged only after approval — they don't pay until approved, but they must know about the fee before applying).

## Build notes
- Do not start building until the Stripe checkout browser task finishes (avoid deploy clashes); then implement + deploy once.
- Agreement text must be drafted for Steven's review before it goes live (legal-ish document).
- Note: the app originally only handled $20/mo memberships via Stripe; cleaning-job payments were not modeled. **Modeled Nov 21, 2026 (booking build):** flat rates Regular $180 / Deep $350 / Move-in-out $450, charged at booking via Stripe one-time payment (`src/lib/pricing.ts` is the single source of truth); 20/80 split — company keeps 20%, cleaner gets 80% (Regular $36/$144, Deep $70/$280, Move-out $90/$360), cleaner paid biweekly after the company gets paid. See DEPLOY.md section 3f. The biweekly pay timing is agreement text, not an automatic payout — no Stripe Connect in this build.
