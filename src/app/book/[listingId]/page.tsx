import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getApplicationByUserId,
  getListingById,
  getUserById,
  hasSignedHomeownerAgreement,
} from "@/lib/db";
import BookingForm from "@/components/BookingForm";

function GateCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 680 }}>
        <h2>{title}</h2>
        <div className="card" style={{ marginTop: 20 }}>
          {children}
        </div>
      </div>
    </section>
  );
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?next=/book/${listingId}`);
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    return (
      <GateCard title="Book a clean">
        <p className="muted">We couldn&apos;t find your account. Try signing in again.</p>
        <p>
          <Link href="/login" className="btn btn-brand">Log in →</Link>
        </p>
      </GateCard>
    );
  }

  if (user.role !== "client") {
    return (
      <GateCard title="Book a clean">
        <p className="muted">
          Booking is for homeowners. Boi accounts manage their own listings
          and bookings from the dashboard instead.
        </p>
        <p>
          <Link href="/dashboard" className="btn btn-brand">Back to your dashboard →</Link>
        </p>
      </GateCard>
    );
  }

  if (!hasSignedHomeownerAgreement(user)) {
    return (
      <GateCard title="One more step first">
        <p className="muted">
          Before you can book, sign the homeowner agreement &amp; waiver on
          your dashboard — it covers breakage while cleaners are on duty and
          the zero-tolerance rule on harassment. It only takes a minute.
        </p>
        <p>
          <Link href="/dashboard" className="btn btn-brand">Sign it on your dashboard →</Link>
        </p>
      </GateCard>
    );
  }

  if (user.subscription_status !== "active") {
    return (
      <GateCard title="Membership required">
        <p className="muted">
          Booking a clean requires the $20/month homeowner membership — it
          unlocks the roster and booking. Subscribe first, then come back
          and book.
        </p>
        <p>
          <Link href="/pricing" className="btn btn-brand">See membership — $20/month →</Link>
        </p>
      </GateCard>
    );
  }

  const listing = await getListingById(listingId);
  if (!listing || !listing.published) {
    return (
      <GateCard title="Book a clean">
        <p className="muted">
          That listing isn&apos;t available right now — it may have been
          unpublished. Pick another boi from the roster.
        </p>
        <p>
          <Link href="/roster" className="btn btn-brand">Browse the roster →</Link>
        </p>
      </GateCard>
    );
  }

  // The boi has to be approved AND actively subscribed to be bookable.
  const boiUser = await getUserById(listing.user_id);
  const application = await getApplicationByUserId(listing.user_id);
  if (
    !boiUser ||
    boiUser.subscription_status !== "active" ||
    !application ||
    application.status !== "approved"
  ) {
    return (
      <GateCard title="Book a clean">
        <p className="muted">
          {listing.display_name} isn&apos;t bookable right now. Pick another
          boi from the roster.
        </p>
        <p>
          <Link href="/roster" className="btn btn-brand">Browse the roster →</Link>
        </p>
      </GateCard>
    );
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 780 }}>
        <h2>Book {listing.display_name}</h2>
        <div className="card" style={{ marginTop: 20 }}>
          {listing.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photo_url}
              alt={listing.display_name}
              style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }}
            />
          ) : (
            <div className="avatar" aria-hidden="true">🔥</div>
          )}
          <h3 style={{ marginTop: 12 }}>{listing.display_name}</h3>
          <p className="muted" style={{ margin: "4px 0" }}>📍 {listing.city}</p>
          <p>
            {listing.looks.map((look) => (
              <span key={look} className="pill" style={{ margin: "0 6px 6px 0" }}>{look}</span>
            ))}
          </p>
          {listing.availability && (
            <p className="small"><strong>Availability:</strong> {listing.availability}</p>
          )}
          {listing.bio && <p className="small muted">{listing.bio}</p>}
        </div>
        <div className="card" style={{ marginTop: 20 }}>
          <h3>Your clean</h3>
          <BookingForm listingId={listing.id} />
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>
          Changed your mind? <Link href="/roster">Back to the roster →</Link>
        </p>
      </div>
    </section>
  );
}
