import { sql } from "@vercel/postgres";

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
  current_period_end: string | null;
  /** Snapshot of the homeowner agreement text the homeowner signed, if any. */
  homeowner_agreement_text: string | null;
  homeowner_agreement_signature: string | null;
  homeowner_agreement_signed_at: string | null;
  /** Homeowner date of birth (YYYY-MM-DD) for the 18+ rule. Null for bois and for homeowners who signed before this was collected. */
  dob: string | null;
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
  photo_url: string | null;
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
  await sql`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      city TEXT NOT NULL,
      looks TEXT NOT NULL DEFAULT '[]',
      availability TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      photo_url TEXT,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    );
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

export async function updateUserSubscriptionByCustomer(
  stripeCustomerId: string,
  patch: {
    subscription_status: string;
    stripe_subscription_id?: string | null;
    current_period_end?: string | null;
  }
) {
  await ensureSchema();
  await sql`
    UPDATE users SET
      subscription_status = ${patch.subscription_status},
      stripe_subscription_id = ${patch.stripe_subscription_id ?? null},
      current_period_end = ${patch.current_period_end ?? null}
    WHERE stripe_customer_id = ${stripeCustomerId}
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
    photo_url: string | null;
    published: boolean;
  }
): Promise<ListingRow> {
  await ensureSchema();
  const { rows } = await sql<ListingRow>`
    INSERT INTO listings (id, user_id, display_name, city, looks, availability, bio, photo_url, published)
    VALUES (${id}, ${userId}, ${data.display_name}, ${data.city}, ${JSON.stringify(data.looks)}, ${data.availability}, ${data.bio}, ${data.photo_url}, ${data.published})
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      city = EXCLUDED.city,
      looks = EXCLUDED.looks,
      availability = EXCLUDED.availability,
      bio = EXCLUDED.bio,
      photo_url = EXCLUDED.photo_url,
      published = EXCLUDED.published,
      updated_at = NOW()
    RETURNING *
  `;
  return parseListing(rows[0]);
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
