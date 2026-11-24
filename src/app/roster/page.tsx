import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getPublishedListings, getUserById, hasSignedHomeownerAgreement } from "@/lib/db";
import SubscribeButton from "@/components/SubscribeButton";

export const metadata: Metadata = {
  title: "Browse Cleaners in Arizona | AZ House Bois",
  description:
    "Meet the House Bois cleaning homes across Phoenix, Mesa, Scottsdale and Tempe. Browse profiles and book a cleaning — members only.",
};

const CITIES = [
  "Phoenix", "Scottsdale", "Paradise Valley", "Tempe", "Mesa", "Chandler",
  "Gilbert", "Glendale", "Peoria", "Surprise", "Goodyear", "Queen Creek",
  "Tucson", "Oro Valley", "Flagstaff", "Sedona", "Prescott", "Lake Havasu", "Yuma",
];

export default async function Roster({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const session = await auth();
  const user = session?.user?.id ? await getUserById(session.user.id) : null;
  const { city } = await searchParams;
  // The admin browses the roster free — no membership needed to see his
  // own site. Booking still requires a paid subscription, admin included.
  const isAdmin = user ? isAdminEmail(user.email) : false;

  if (!user || (!isAdmin && (user.role !== "client" || user.subscription_status !== "active"))) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 680 }}>
          <h2>Members only</h2>
          <p className="muted">
            The roster is private — only subscribed homeowners can browse the
            bois. Your $20/month membership unlocks the full list: photos,
            vibe, looks offered, city and availability.
          </p>
          <div className="card" style={{ marginTop: 24 }}>
            <p style={{ fontSize: "1.6rem", fontWeight: 900 }}>
              $20<span className="muted" style={{ fontSize: "1rem" }}>/month</span>
            </p>
            <SubscribeButton role="client" label="Subscribe to browse the roster" />
            {!user && (
              <p className="small" style={{ marginTop: 12 }}>
                Already a member? <Link href="/login?next=/roster">Log in</Link>
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Homeowners who subscribed before the agreement existed still have to
  // sign it before they can browse — the roster API enforces this too.
  // The admin is exempt: he browses free.
  if (!isAdmin && !hasSignedHomeownerAgreement(user)) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 680 }}>
          <h2>One more step first</h2>
          <p className="muted">
            Before you can browse the roster, sign the homeowner agreement
            &amp; waiver — it covers breakage while cleaners are on duty and
            the zero-tolerance rule on harassment. It only takes a minute.
          </p>
          <div className="card" style={{ marginTop: 24 }}>
            <Link href="/dashboard" className="btn btn-brand">
              Sign it on your dashboard →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const listings = await getPublishedListings({ city: city || undefined });

  return (
    <section className="section">
      <div className="container">
        <h2>The roster</h2>
        <p className="muted">Members-only browsing. Pick your boi, pick the look, set your regular schedule.</p>
        {isAdmin && (
          <p className="small muted">Admin view — no membership needed to browse.</p>
        )}

        <form method="get" style={{ margin: "20px 0", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select name="city" defaultValue={city ?? ""} style={{ maxWidth: 260 }}>
            <option value="">All cities</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-teal" style={{ padding: "12px 22px" }}>
            Filter
          </button>
          {city && (
            <Link href="/roster" className="btn btn-ghost">Clear</Link>
          )}
        </form>

        {listings.length === 0 ? (
          <div className="card">
            <h3>No bois listed{city ? ` in ${city}` : " yet"}.</h3>
            <p className="muted">
              The roster is brand new — bois are still signing up. Check back
              soon, or join anyway and demand in your city helps us recruit
              the next bois there.
            </p>
          </div>
        ) : (
          <div className="grid-3">
            {listings.map((l) => {
              // The pasted photo URL wins; otherwise the photo from the
              // application is the roster photo.
              const photoSrc = l.photo_url || l.photo_data;
              const areas = (l.service_areas || "")
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean);
              return (
              <article key={l.id} className="card roster-card">
                {photoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoSrc} alt={l.display_name} />
                ) : (
                  <div className="avatar" aria-hidden="true">🔥</div>
                )}
                <h3 style={{ marginTop: 14 }}>{l.display_name}</h3>
                <p className="muted" style={{ margin: "4px 0" }}>📍 {l.city}</p>
                {areas.length > 0 && (
                  <p>
                    {areas.map((area) => (
                      <span key={area} className="pill" style={{ margin: "0 6px 6px 0" }}>{area}</span>
                    ))}
                  </p>
                )}
                <p>
                  {l.looks.map((look) => (
                    <span key={look} className="pill" style={{ margin: "0 6px 6px 0" }}>{look}</span>
                  ))}
                </p>
                {l.availability && <p className="small"><strong>Availability:</strong> {l.availability}</p>}
                {l.experience && <p className="small"><strong>Experience:</strong> {l.experience}</p>}
                {l.bio && <p className="small muted">{l.bio}</p>}
                <Link href={`/book/${l.id}`} className="btn btn-brand" style={{ marginTop: 8 }}>
                  Book {l.display_name} →
                </Link>
              </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
