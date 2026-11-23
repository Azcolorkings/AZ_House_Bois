import { randomUUID } from "crypto";
import { sql } from "@vercel/postgres";
import { FOUNDING_FREE_SPOTS } from "@/lib/pricing";

// Vercel's Neon Postgres integration exposes DATABASE_URL; @vercel/postgres
// reads POSTGRES_URL, so mirror it when only the former is set.
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}

export type Role = "client" | "boi";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  stripe_customer_id: string | null;
  subscription_status: string;
  stripe_subscription_id: string | null;
  /** "stripe" | "paypal" — which provider the active subscription is paid through. Null for pre-PayPal accounts (treated as Stripe). */
  payment_provider: string | null;
  /** PayPal subscription id, when the membership is paid through PayPal. */
  paypal_subscription_id: string | null;
  current_period_end: string | null;
  /** Snapshot of the homeowner agreement text the homeowner signed, if any. */
  homeowner_agreement_text: string | null;
  homeowner_agreement_signature: string | null;
  homeowner_agreement_signed_at: string | null;
  /** Homeowner date of birth (YYYY-MM-DD) for the 18+ rule. Null for bois and for homeowners who signed before this was collected. */
  dob: string | null;
  /** True when this boi used one of the 5 founding free months. */
  founding_free_used: boolean;
  /** True when the admin suspended the account — suspended users cannot sign in or use the site. */
  suspended: boolean;
  created_at: string;
}

export interface ListingRow {
  id: string;
  user_id: string;
  display_name: string;
  city: string;
  looks: string[];
  availability: string;
  bio: string;
  /** Cleaning experience, prefilled from the approved application; the boi can edit it in the listing form. */
  experience: string;
  /** Service areas, prefilled from the approved application; the boi can edit it in the listing form. */
  service_areas: string;
  photo_url: string | null;
  /** Profile photo from the approved application (data URL). The pasted photo_url wins when set; otherwise this is the roster photo. */
  photo_data: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: string;
  user_id: string;
  legal_name: string;
  dob: string;
  address: string;
  phone: string;
  /** AES-256-GCM ciphertext (base64). NEVER a plaintext SSN. */
  ssn_encrypted: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  experience: string;
  availability: string;
  service_areas: string;
  /** Profile photo as a data URL (image only, size-limited). */
  photo_data: string | null;
  /** Photo ID upload as a data URL (image only, size-limited). */
  id_upload_data: string | null;
  /** Snapshot of the agreement text the cleaner signed. */
  agreement_text: string;
  agreement_signature: string;
  agreement_signed_at: string;
  status: "pending" | "approved" | "denied";
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationWithEmail extends ApplicationRow {
  email: string;
}

let initialized = false;

/** Create the tables on first use. Safe to call on every request. */
export async function ensureSchema() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('client', 'boi')),
      stripe_customer_id TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'none',
      stripe_subscription_id TEXT,
      current_period_end TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  // Homeowner agreement columns were added after launch (Nov 21, 2026);
  // the users table may already exist without them.
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS homeowner_agreement_text TEXT,
      ADD COLUMN IF NOT EXISTS homeowner_agreement_signature TEXT,
      ADD COLUMN IF NOT EXISTS homeowner_agreement_signed_at TIMESTAMPTZ
  `;
  // Homeowner date of birth for the 18+ rule (added Nov 21, 2026).
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS dob TEXT
  `;
  // Founding free month flag (added Nov 21, 2026): one of the 5 free
  // first months for approved bois. Set ONLY by the Stripe webhook,
  // after the subscription actually completes — never at Checkout
  // Session creation, so an abandoned checkout burns no spot.
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS founding_free_used BOOLEAN NOT NULL DEFAULT FALSE
  `;
  // Suspended flag (added Nov 22, 2026): the admin can suspend an
  // account from the admin dashboard. Suspended users cannot sign in,
  // and the auth layer blocks their existing sessions too. Suspending
  // never deletes anything and never touches Stripe.
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE
  `;
  // PayPal columns (added Nov 22, 2026): which provider the membership
  // is paid through, and the PayPal subscription id. Additive only —
  // existing Stripe accounts keep working with NULL here.
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS payment_provider TEXT,
      ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      city TEXT NOT NULL,
      looks TEXT NOT NULL DEFAULT '[]',
      availability TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      experience TEXT NOT NULL DEFAULT '',
      service_areas TEXT NOT NULL DEFAULT '',
      photo_url TEXT,
      photo_data TEXT,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    );
  `;
  // Experience / service areas / application photo were added Nov 21, 2026;
  // a deployment created before that has the table without them.
  await sql`
    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS experience TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS service_areas TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS photo_data TEXT
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      legal_name TEXT NOT NULL,
      dob TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      ssn_encrypted TEXT NOT NULL,
      emergency_contact_name TEXT NOT NULL,
      emergency_contact_phone TEXT NOT NULL,
      experience TEXT NOT NULL DEFAULT '',
      availability TEXT NOT NULL DEFAULT '',
      service_areas TEXT NOT NULL DEFAULT '',
      photo_data TEXT,
      id_upload_data TEXT,
      agreement_text TEXT NOT NULL,
      agreement_signature TEXT NOT NULL,
      agreement_signed_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  // Bookings (added Nov 21, 2026). One row per clean, paid once at
  // booking time through Stripe Checkout (payment mode). Frequency is
  // informational — payment covers the single upcoming clean only;
  // there is no recurring billing for cleans.
  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      boi_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      service TEXT NOT NULL CHECK (service IN ('regular', 'deep', 'moveout')),
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      company_amount_cents INTEGER NOT NULL DEFAULT 0,
      cleaner_amount_cents INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'one-time' CHECK (frequency IN ('one-time', 'weekly', 'every-2-weeks', 'monthly')),
      service_address TEXT NOT NULL DEFAULT '',
      supplies_by_homeowner BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'declined', 'completed', 'cancelled')),
      stripe_checkout_session_id TEXT,
      stripe_payment_intent_id TEXT,
      paid_at TIMESTAMPTZ,
      refund_status TEXT NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none', 'not_required', 'refunded', 'failed')),
      needs_refund BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  // Split columns were added the same day as the bookings table; a
  // deployment created before that has the table without them.
  await sql`
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS company_amount_cents INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cleaner_amount_cents INTEGER NOT NULL DEFAULT 0
  `;
  // PayPal columns (added Nov 22, 2026): which provider the booking was
  // paid through, and the PayPal order/capture ids. Additive only —
  // existing Stripe bookings keep working with the defaults.
  await sql`
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe',
      ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
      ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT
  `;
  initialized = true;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  await ensureSchema();
  const { rows } = await sql<UserRow>`
    SELECT * FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  await ensureSchema();
  const { rows } = await sql<UserRow>`
    SELECT * FROM users WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createUser(
  id: string,
  email: string,
  passwordHash: string,
  role: Role,
  homeownerAgreement?: {
    text: string;
    signature: string;
    signedAt: string;
  },
  /** Homeowner date of birth (YYYY-MM-DD) for the 18+ rule. Only collected for homeowners. */
  dob?: string | null
): Promise<UserRow> {
  await ensureSchema();
  const { rows } = await sql<UserRow>`
    INSERT INTO users (
      id, email, password_hash, role,
      homeowner_agreement_text, homeowner_agreement_signature,
      homeowner_agreement_signed_at, dob
    )
    VALUES (
      ${id}, ${email}, ${passwordHash}, ${role},
      ${homeownerAgreement?.text ?? null},
      ${homeownerAgreement?.signature ?? null},
      ${homeownerAgreement?.signedAt ?? null},
      ${dob ?? null}
    )
    RETURNING *
  `;
  return rows[0];
}

/** True when a homeowner has signed the homeowner agreement & waiver. */
export function hasSignedHomeownerAgreement(user: UserRow): boolean {
  return Boolean(
    user.homeowner_agreement_text && user.homeowner_agreement_signature
  );
}

/** Record a homeowner's signed agreement. One signature per account. */
export async function signHomeownerAgreement(
  userId: string,
  data: { text: string; signature: string; signedAt: string; dob?: string | null }
): Promise<UserRow | null> {
  await ensureSchema();
  const { rows } = await sql<UserRow>`
    UPDATE users SET
      homeowner_agreement_text = ${data.text},
      homeowner_agreement_signature = ${data.signature},
      homeowner_agreement_signed_at = ${data.signedAt},
      dob = COALESCE(${data.dob ?? null}, dob)
    WHERE id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function updateUserStripe(
  id: string,
  patch: {
    stripe_customer_id?: string;
    subscription_status?: string;
    stripe_subscription_id?: string | null;
    current_period_end?: string | null;
  }
) {
  await ensureSchema();
  await sql`
    UPDATE users SET
      stripe_customer_id = COALESCE(${patch.stripe_customer_id ?? null}, stripe_customer_id),
      subscription_status = COALESCE(${patch.subscription_status ?? null}, subscription_status),
      stripe_subscription_id = ${patch.stripe_subscription_id ?? null},
      current_period_end = ${patch.current_period_end ?? null}
    WHERE id = ${id}
  `;
}

/** How many of the 5 founding free months have been used (boi accounts only). */
export async function countFoundingFreeUsed(): Promise<number> {
  await ensureSchema();
  const { rows } = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count FROM users
    WHERE role = 'boi' AND founding_free_used = TRUE
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Mark that this boi used one of the founding free months. Call ONLY
 * from the Stripe webhook, after the subscription actually completed
 * (checkout.session.completed or customer.subscription.created with
 * metadata founding_free=1). NEVER at Checkout Session creation — an
 * abandoned checkout must not burn a spot. Idempotent: setting TRUE
 * twice is harmless, so duplicate webhook deliveries are safe.
 */
export async function markFoundingFreeUsed(userId: string): Promise<void> {
  await ensureSchema();
  await sql`
    UPDATE users SET founding_free_used = TRUE WHERE id = ${userId}
  `;
}

/**
 * Reopen all founding free months: clears the used flag for every user.
 * Admin-only — callers must gate to isAdminEmail. Used when the owner
 * wants the 5 first-month-free spots available again (e.g. a test
 * account burned one). Never touches Stripe.
 */
export async function resetFoundingFreeUsed(): Promise<void> {
  await ensureSchema();
  await sql`
    UPDATE users SET founding_free_used = FALSE WHERE founding_free_used = TRUE
  `;
}

/**
 * Admin analytics — server-side counts from the existing tables only.
 * No external service, no Stripe API calls. Used by the Analytics
 * section at the top of /admin. All money is in cents.
 */
export interface AdminAnalytics {
  accounts: {
    total: number;
    clients: number;
    bois: number;
    newLast7Days: number;
    newLast30Days: number;
    suspended: number;
  };
  applications: { pending: number; approved: number; denied: number };
  subscriptions: { paying: number; notSubscribed: number };
  listings: { published: number; drafts: number };
  bookings: {
    requested: number;
    confirmed: number;
    declined: number;
    cancelled: number;
    completed: number;
    paidTotalCents: number;
    companyEarnedCents: number;
    cleanerOwedCents: number;
  };
  foundingSpotsLeft: number;
  signupsByDay: { date: string; count: number }[];
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  await ensureSchema();

  const { rows: accountRows } = await sql<{
    total: string;
    clients: string;
    bois: string;
    new_7: string;
    new_30: string;
    suspended: string;
  }>`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE role = 'client')::text AS clients,
      COUNT(*) FILTER (WHERE role = 'boi')::text AS bois,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS new_7,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS new_30,
      COUNT(*) FILTER (WHERE suspended)::text AS suspended
    FROM users
  `;
  const a = accountRows[0];

  const { rows: appRows } = await sql<{ status: string; count: string }>`
    SELECT status, COUNT(*)::text AS count FROM applications GROUP BY status
  `;
  const appCount = (s: string) =>
    Number(appRows.find((r) => r.status === s)?.count ?? 0);

  const { rows: subRows } = await sql<{
    paying: string;
    not_subscribed: string;
  }>`
    SELECT
      COUNT(*) FILTER (WHERE subscription_status = 'active')::text AS paying,
      COUNT(*) FILTER (WHERE subscription_status = 'none')::text AS not_subscribed
    FROM users
  `;
  const s = subRows[0];

  const { rows: listingRows } = await sql<{
    published: string;
    drafts: string;
  }>`
    SELECT
      COUNT(*) FILTER (WHERE published)::text AS published,
      COUNT(*) FILTER (WHERE NOT published)::text AS drafts
    FROM listings
  `;
  const l = listingRows[0];

  const { rows: bookingRows } = await sql<{
    status: string;
    count: string;
  }>`
    SELECT status, COUNT(*)::text AS count FROM bookings GROUP BY status
  `;
  const bookCount = (st: string) =>
    Number(bookingRows.find((r) => r.status === st)?.count ?? 0);
  const { rows: moneyRows } = await sql<{
    paid_total: string;
    company_earned: string;
    cleaner_owed: string;
  }>`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE paid_at IS NOT NULL), 0)::text AS paid_total,
      COALESCE(SUM(company_amount_cents) FILTER (WHERE paid_at IS NOT NULL), 0)::text AS company_earned,
      COALESCE(SUM(cleaner_amount_cents) FILTER (WHERE status IN ('confirmed', 'completed')), 0)::text AS cleaner_owed
    FROM bookings
  `;
  const m = moneyRows[0];

  // Founding spots left: 5 minus bois who used a free month. Same
  // counter the site copy uses, so the numbers always agree.
  const foundingUsed = await countFoundingFreeUsed();

  // Signups per day, last 14 days, Phoenix dates. Days with no
  // signups return no row, so fill the gaps with zeros here.
  const { rows: dayRows } = await sql<{ day: string; count: string }>`
    SELECT TO_CHAR(created_at AT TIME ZONE 'America/Phoenix', 'YYYY-MM-DD') AS day,
      COUNT(*)::text AS count
    FROM users
    WHERE created_at >= NOW() - INTERVAL '14 days'
    GROUP BY day
    ORDER BY day
  `;
  const byDay = new Map(dayRows.map((r) => [r.day, Number(r.count)]));
  const dayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const signupsByDay = Array.from({ length: 14 }, (_, i) => {
    const date = dayFmt.format(Date.now() - (13 - i) * 86400000);
    return { date, count: byDay.get(date) ?? 0 };
  });

  return {
    accounts: {
      total: Number(a?.total ?? 0),
      clients: Number(a?.clients ?? 0),
      bois: Number(a?.bois ?? 0),
      newLast7Days: Number(a?.new_7 ?? 0),
      newLast30Days: Number(a?.new_30 ?? 0),
      suspended: Number(a?.suspended ?? 0),
    },
    applications: {
      pending: appCount("pending"),
      approved: appCount("approved"),
      denied: appCount("denied"),
    },
    subscriptions: {
      paying: Number(s?.paying ?? 0),
      notSubscribed: Number(s?.not_subscribed ?? 0),
    },
    listings: {
      published: Number(l?.published ?? 0),
      drafts: Number(l?.drafts ?? 0),
    },
    bookings: {
      requested: bookCount("requested"),
      confirmed: bookCount("confirmed"),
      declined: bookCount("declined"),
      cancelled: bookCount("cancelled"),
      completed: bookCount("completed"),
      paidTotalCents: Number(m?.paid_total ?? 0),
      companyEarnedCents: Number(m?.company_earned ?? 0),
      cleanerOwedCents: Number(m?.cleaner_owed ?? 0),
    },
    foundingSpotsLeft: Math.max(
      0,
      FOUNDING_FREE_SPOTS - foundingUsed
    ),
    signupsByDay,
  };
}

/**
 * Suspend or unsuspend an account. Admin-only — callers must gate to
 * isAdminEmail. Never deletes anything and never touches Stripe; the
 * auth layer enforces the flag at sign-in and on every session check.
 */
export async function setUserSuspended(
  id: string,
  suspended: boolean
): Promise<UserRow | null> {
  await ensureSchema();
  const { rows } = await sql<UserRow>`
    UPDATE users SET suspended = ${suspended}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Permanently delete an account and everything tied to it. Admin-only —
 * callers must gate to isAdminEmail and refuse the admin account itself.
 * Dependent rows are deleted first (bookings where the user is client
 * or boi, then their application and listing) so nothing is orphaned;
 * the tables also carry ON DELETE CASCADE as a backstop. Never touches
 * Stripe — a deleted user's Stripe customer/subscription is left alone.
 */
export async function deleteUser(id: string): Promise<boolean> {
  await ensureSchema();
  await sql`
    DELETE FROM bookings WHERE client_user_id = ${id} OR boi_user_id = ${id}
  `;
  await sql`
    DELETE FROM applications WHERE user_id = ${id}
  `;
  await sql`
    DELETE FROM listings WHERE user_id = ${id}
  `;
  const { rowCount } = await sql`
    DELETE FROM users WHERE id = ${id}
  `;
  return (rowCount ?? 0) > 0;
}

/** One row per account for the admin dashboard — status fields only, never sensitive application details. */
export interface AdminUserRow {
  id: string;
  email: string;
  role: Role;
  subscription_status: string;
  suspended: boolean;
  created_at: string;
  /** True when the homeowner signed the homeowner agreement & waiver. */
  homeowner_agreement_signed: boolean;
  /** Boi application status, or null when the boi never applied. */
  application_status: "pending" | "approved" | "denied" | null;
  /** True when the boi has a published roster listing. */
  listing_published: boolean;
  /** Display name from the boi's listing, if they have one. */
  display_name: string | null;
}

/** Admin: every account, newest first, with application + listing status joined in. */
export async function listAllUsersForAdmin(): Promise<AdminUserRow[]> {
  await ensureSchema();
  const { rows } = await sql<AdminUserRow>`
    SELECT
      u.id, u.email, u.role, u.subscription_status, u.suspended, u.created_at,
      (u.homeowner_agreement_text IS NOT NULL
        AND u.homeowner_agreement_signature IS NOT NULL) AS homeowner_agreement_signed,
      a.status AS application_status,
      COALESCE(l.published, FALSE) AS listing_published,
      l.display_name AS display_name
    FROM users u
    LEFT JOIN applications a ON a.user_id = u.id
    LEFT JOIN listings l ON l.user_id = u.id
    ORDER BY u.created_at DESC
  `;
  return rows;
}

export async function updateUserSubscriptionByCustomer(
  stripeCustomerId: string,
  patch: {
    subscription_status: string;
    stripe_subscription_id?: string | null;
    current_period_end?: string | null;
  }
) {
  await ensureSchema();
  // COALESCE keeps the stored subscription id / period end when the
  // caller does not supply one — a partial update (e.g. the
  // checkout.session.completed handler, which only knows the
  // subscription is live) must never null out values a previous
  // event already set.
  await sql`
    UPDATE users SET
      subscription_status = ${patch.subscription_status},
      stripe_subscription_id = COALESCE(${patch.stripe_subscription_id ?? null}, stripe_subscription_id),
      current_period_end = COALESCE(${patch.current_period_end ?? null}, current_period_end)
    WHERE stripe_customer_id = ${stripeCustomerId}
  `;
}

/**
 * PayPal counterpart of updateUserSubscriptionByCustomer: the PayPal
 * subscription carries the user id in its custom_id, so the lookup is
 * by user id, not by a customer id. Also records payment_provider so
 * the dashboard knows to show the PayPal manage note instead of the
 * Stripe Customer Portal button.
 */
export async function updateUserPayPalSubscription(
  userId: string,
  patch: {
    subscription_status: string;
    paypal_subscription_id?: string | null;
    current_period_end?: string | null;
  }
) {
  await ensureSchema();
  await sql`
    UPDATE users SET
      subscription_status = ${patch.subscription_status},
      payment_provider = 'paypal',
      paypal_subscription_id = ${patch.paypal_subscription_id ?? null},
      current_period_end = ${patch.current_period_end ?? null}
    WHERE id = ${userId}
  `;
}

export async function getListingByUserId(userId: string): Promise<ListingRow | null> {
  await ensureSchema();
  const { rows } = await sql<ListingRow>`
    SELECT * FROM listings WHERE user_id = ${userId} LIMIT 1
  `;
  return rows[0] ? parseListing(rows[0]) : null;
}

/** `looks` is stored as a JSON string; parse it back to an array. */
function parseListing(row: ListingRow): ListingRow {
  let looks: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(row.looks));
    if (Array.isArray(parsed)) looks = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    looks = [];
  }
  return { ...row, looks };
}

export async function upsertListing(
  id: string,
  userId: string,
  data: {
    display_name: string;
    city: string;
    looks: string[];
    availability: string;
    bio: string;
    experience: string;
    service_areas: string;
    photo_url: string | null;
    photo_data: string | null;
    published: boolean;
  }
): Promise<ListingRow> {
  await ensureSchema();
  const { rows } = await sql<ListingRow>`
    INSERT INTO listings (id, user_id, display_name, city, looks, availability, bio, experience, service_areas, photo_url, photo_data, published)
    VALUES (${id}, ${userId}, ${data.display_name}, ${data.city}, ${JSON.stringify(data.looks)}, ${data.availability}, ${data.bio}, ${data.experience}, ${data.service_areas}, ${data.photo_url}, ${data.photo_data}, ${data.published})
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      city = EXCLUDED.city,
      looks = EXCLUDED.looks,
      availability = EXCLUDED.availability,
      bio = EXCLUDED.bio,
      experience = EXCLUDED.experience,
      service_areas = EXCLUDED.service_areas,
      photo_url = EXCLUDED.photo_url,
      photo_data = EXCLUDED.photo_data,
      published = EXCLUDED.published,
      updated_at = NOW()
    RETURNING *
  `;
  return parseListing(rows[0]);
}

// Roster cities, shared by the roster filter and the listing form. Used
// here only to pick a listing city out of free-text service areas.
const ROSTER_CITIES = [
  "Phoenix", "Scottsdale", "Paradise Valley", "Tempe", "Mesa", "Chandler",
  "Gilbert", "Glendale", "Peoria", "Surprise", "Goodyear", "Queen Creek",
  "Tucson", "Oro Valley", "Flagstaff", "Sedona", "Prescott", "Lake Havasu", "Yuma",
];

/** First service area that matches a known roster city, else Phoenix. */
function cityFromServiceAreas(serviceAreas: string): string {
  const areas = serviceAreas.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  for (const area of areas) {
    const match = ROSTER_CITIES.find((c) => c.toLowerCase() === area);
    if (match) return match;
  }
  return "Phoenix";
}

/**
 * Prefill a boi's listing from their approved application — experience,
 * service areas, and profile photo. Only those three application fields
 * ever carry over; SSN, ID, address, and everything else stays in the
 * application. Called when Steven approves an application.
 *
 * Creates an unpublished draft when the boi has no listing yet. When a
 * listing already exists it is never overwritten — only the application
 * photo is backfilled when the listing has none, so the boi's own edits
 * always win. The boi edits all three fields in the listing form.
 */
export async function prefillListingFromApplication(
  app: ApplicationRow
): Promise<ListingRow | null> {
  await ensureSchema();
  const existing = await getListingByUserId(app.user_id);
  if (existing) {
    if (!existing.photo_data && app.photo_data) {
      return upsertListing(existing.id, app.user_id, {
        ...existing,
        photo_data: app.photo_data,
      });
    }
    return existing;
  }
  return upsertListing(randomUUID(), app.user_id, {
    display_name: app.legal_name,
    city: cityFromServiceAreas(app.service_areas),
    looks: ["Classic Boi"],
    availability: app.availability,
    bio: "",
    experience: app.experience,
    service_areas: app.service_areas,
    photo_url: null,
    photo_data: app.photo_data,
    published: false,
  });
}

export async function getListingById(
  id: string
): Promise<ListingRow | null> {
  await ensureSchema();
  const { rows } = await sql<ListingRow>`
    SELECT * FROM listings WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ? parseListing(rows[0]) : null;
}

export async function getPublishedListings(filters?: { city?: string }): Promise<ListingRow[]> {
  await ensureSchema();
  if (filters?.city) {
    const { rows } = await sql<ListingRow>`
      SELECT * FROM listings
      WHERE published = TRUE AND city = ${filters.city}
      ORDER BY created_at DESC
    `;
    return rows.map(parseListing);
  }
  const { rows } = await sql<ListingRow>`
    SELECT * FROM listings WHERE published = TRUE ORDER BY created_at DESC
  `;
  return rows.map(parseListing);
}

// --- Cleaner applications ---

export async function getApplicationByUserId(
  userId: string
): Promise<ApplicationRow | null> {
  await ensureSchema();
  const { rows } = await sql<ApplicationRow>`
    SELECT * FROM applications WHERE user_id = ${userId} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** One application per cleaner. Re-applying after a denial replaces the old one and resets it to pending. */
export async function upsertApplication(
  id: string,
  userId: string,
  data: Omit<ApplicationRow, "id" | "user_id" | "status" | "reviewed_at" | "reviewed_by" | "created_at" | "updated_at">
): Promise<ApplicationRow> {
  await ensureSchema();
  const { rows } = await sql<ApplicationRow>`
    INSERT INTO applications (
      id, user_id, legal_name, dob, address, phone, ssn_encrypted,
      emergency_contact_name, emergency_contact_phone, experience,
      availability, service_areas, photo_data, id_upload_data,
      agreement_text, agreement_signature, agreement_signed_at
    )
    VALUES (
      ${id}, ${userId}, ${data.legal_name}, ${data.dob}, ${data.address},
      ${data.phone}, ${data.ssn_encrypted}, ${data.emergency_contact_name},
      ${data.emergency_contact_phone}, ${data.experience}, ${data.availability},
      ${data.service_areas}, ${data.photo_data}, ${data.id_upload_data},
      ${data.agreement_text}, ${data.agreement_signature}, ${data.agreement_signed_at}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      legal_name = EXCLUDED.legal_name,
      dob = EXCLUDED.dob,
      address = EXCLUDED.address,
      phone = EXCLUDED.phone,
      ssn_encrypted = EXCLUDED.ssn_encrypted,
      emergency_contact_name = EXCLUDED.emergency_contact_name,
      emergency_contact_phone = EXCLUDED.emergency_contact_phone,
      experience = EXCLUDED.experience,
      availability = EXCLUDED.availability,
      service_areas = EXCLUDED.service_areas,
      photo_data = EXCLUDED.photo_data,
      id_upload_data = EXCLUDED.id_upload_data,
      agreement_text = EXCLUDED.agreement_text,
      agreement_signature = EXCLUDED.agreement_signature,
      agreement_signed_at = EXCLUDED.agreement_signed_at,
      status = 'pending',
      reviewed_at = NULL,
      reviewed_by = NULL,
      updated_at = NOW()
    RETURNING *
  `;
  return rows[0];
}

/** Admin: every application, newest first, with the applicant's email. */
export async function listApplications(): Promise<ApplicationWithEmail[]> {
  await ensureSchema();
  const { rows } = await sql<ApplicationWithEmail>`
    SELECT a.*, u.email AS email
    FROM applications a
    JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
  `;
  return rows;
}

export interface BookingRow {
  id: string;
  client_user_id: string;
  boi_user_id: string;
  listing_id: string;
  service: "regular" | "deep" | "moveout";
  amount_cents: number;
  currency: string;
  /** AZ House Bois' 20% of the cleaning fee, in cents. */
  company_amount_cents: number;
  /** The cleaner's 80% of the cleaning fee, in cents. */
  cleaner_amount_cents: number;
  /** Date of the clean, YYYY-MM-DD. */
  date: string;
  /** Start time, HH:MM (24h) — one of the TIME_SLOTS in src/lib/pricing.ts. */
  time_slot: string;
  frequency: "one-time" | "weekly" | "every-2-weeks" | "monthly";
  service_address: string;
  /** True when the homeowner has their own cleaning supplies (boi brings none). */
  supplies_by_homeowner: boolean;
  notes: string;
  status: "requested" | "confirmed" | "declined" | "completed" | "cancelled";
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  /** "stripe" | "paypal" — which provider the booking was paid through. */
  payment_provider: string;
  /** PayPal order id, when the booking is paid through PayPal. */
  paypal_order_id: string | null;
  /** PayPal capture id, set when the PayPal payment completes. */
  paypal_capture_id: string | null;
  /** Set by the webhook when the one-time payment completes. */
  paid_at: string | null;
  /** none = no refund attempted/needed yet. */
  refund_status: "none" | "not_required" | "refunded" | "failed";
  /** True when a refund is owed but could not be issued automatically — the admin handles it in Stripe. */
  needs_refund: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingWithNames extends BookingRow {
  client_email: string;
  boi_display_name: string;
  boi_city: string;
}

export async function updateApplicationStatus(
  id: string,
  status: "approved" | "denied",
  reviewedBy: string
): Promise<ApplicationRow | null> {
  await ensureSchema();
  const { rows } = await sql<ApplicationRow>`
    UPDATE applications SET
      status = ${status},
      reviewed_at = NOW(),
      reviewed_by = ${reviewedBy},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

// --- Bookings ---

export async function createBooking(
  id: string,
  data: {
    client_user_id: string;
    boi_user_id: string;
    listing_id: string;
    service: BookingRow["service"];
    amount_cents: number;
    company_amount_cents: number;
    cleaner_amount_cents: number;
    date: string;
    time_slot: string;
    frequency: BookingRow["frequency"];
    service_address: string;
    supplies_by_homeowner: boolean;
    notes: string;
    stripe_checkout_session_id?: string | null;
    /** "stripe" (default) or "paypal". */
    payment_provider?: "stripe" | "paypal";
  }
): Promise<BookingRow> {
  await ensureSchema();
  const { rows } = await sql<BookingRow>`
    INSERT INTO bookings (
      id, client_user_id, boi_user_id, listing_id, service, amount_cents,
      currency, company_amount_cents, cleaner_amount_cents,
      date, time_slot, frequency, service_address,
      supplies_by_homeowner, notes, status, stripe_checkout_session_id,
      payment_provider
    )
    VALUES (
      ${id}, ${data.client_user_id}, ${data.boi_user_id}, ${data.listing_id},
      ${data.service}, ${data.amount_cents}, 'usd',
      ${data.company_amount_cents}, ${data.cleaner_amount_cents}, ${data.date},
      ${data.time_slot}, ${data.frequency}, ${data.service_address},
      ${data.supplies_by_homeowner}, ${data.notes}, 'requested',
      ${data.stripe_checkout_session_id ?? null},
      ${data.payment_provider ?? "stripe"}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function getBookingById(id: string): Promise<BookingRow | null> {
  await ensureSchema();
  const { rows } = await sql<BookingRow>`
    SELECT * FROM bookings WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getBookingByCheckoutSessionId(
  sessionId: string
): Promise<BookingRow | null> {
  await ensureSchema();
  const { rows } = await sql<BookingRow>`
    SELECT * FROM bookings WHERE stripe_checkout_session_id = ${sessionId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getBookingsForClient(
  clientUserId: string
): Promise<BookingWithNames[]> {
  await ensureSchema();
  const { rows } = await sql<BookingWithNames>`
    SELECT b.*, u.email AS client_email, l.display_name AS boi_display_name,
      l.city AS boi_city
    FROM bookings b
    JOIN users u ON u.id = b.client_user_id
    JOIN listings l ON l.id = b.listing_id
    WHERE b.client_user_id = ${clientUserId}
    ORDER BY b.date DESC, b.created_at DESC
  `;
  return rows;
}

export async function getBookingsForBoi(
  boiUserId: string
): Promise<BookingWithNames[]> {
  await ensureSchema();
  const { rows } = await sql<BookingWithNames>`
    SELECT b.*, u.email AS client_email, l.display_name AS boi_display_name,
      l.city AS boi_city
    FROM bookings b
    JOIN users u ON u.id = b.client_user_id
    JOIN listings l ON l.id = b.listing_id
    WHERE b.boi_user_id = ${boiUserId}
    ORDER BY b.date ASC, b.created_at DESC
  `;
  return rows;
}

/** Admin: every booking, newest first. */
export async function getAllBookings(): Promise<BookingWithNames[]> {
  await ensureSchema();
  const { rows } = await sql<BookingWithNames>`
    SELECT b.*, u.email AS client_email, l.display_name AS boi_display_name,
      l.city AS boi_city
    FROM bookings b
    JOIN users u ON u.id = b.client_user_id
    JOIN listings l ON l.id = b.listing_id
    ORDER BY b.created_at DESC
  `;
  return rows;
}

export async function updateBookingStatus(
  id: string,
  status: BookingRow["status"]
): Promise<BookingRow | null> {
  await ensureSchema();
  const { rows } = await sql<BookingRow>`
    UPDATE bookings SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/** Called by the Stripe webhook when the one-time payment completes. */
export async function markBookingPaid(
  id: string,
  paymentIntentId: string | null,
  /** PayPal capture id, when the booking was paid through PayPal. */
  paypalCaptureId: string | null = null
): Promise<BookingRow | null> {
  await ensureSchema();
  const { rows } = await sql<BookingRow>`
    UPDATE bookings SET
      paid_at = NOW(),
      stripe_payment_intent_id = COALESCE(${paymentIntentId}, stripe_payment_intent_id),
      paypal_capture_id = COALESCE(${paypalCaptureId}, paypal_capture_id),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/** PayPal webhook lookup: the order id is the booking's reference. */
export async function getBookingByPayPalOrderId(
  orderId: string
): Promise<BookingRow | null> {
  await ensureSchema();
  const { rows } = await sql<BookingRow>`
    SELECT * FROM bookings WHERE paypal_order_id = ${orderId} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Record the PayPal order created for a booking (before approval). */
export async function setBookingPayPalOrder(
  id: string,
  orderId: string
): Promise<void> {
  await ensureSchema();
  await sql`
    UPDATE bookings SET paypal_order_id = ${orderId}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

/** Record a refund outcome. `needsRefund` true = the admin must refund it by hand in Stripe. */
export async function setBookingRefund(
  id: string,
  refundStatus: BookingRow["refund_status"],
  needsRefund: boolean
): Promise<BookingRow | null> {
  await ensureSchema();
  const { rows } = await sql<BookingRow>`
    UPDATE bookings SET
      refund_status = ${refundStatus},
      needs_refund = ${needsRefund},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function setBookingCheckoutSession(
  id: string,
  sessionId: string
): Promise<void> {
  await ensureSchema();
  await sql`
    UPDATE bookings SET stripe_checkout_session_id = ${sessionId}, updated_at = NOW()
    WHERE id = ${id}
  `;
}
