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
  role: Role
): Promise<UserRow> {
  await ensureSchema();
  const { rows } = await sql<UserRow>`
    INSERT INTO users (id, email, password_hash, role)
    VALUES (${id}, ${email}, ${passwordHash}, ${role})
    RETURNING *
  `;
  return rows[0];
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
