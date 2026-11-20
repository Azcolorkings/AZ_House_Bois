import Link from "next/link";
import { auth } from "@/lib/auth";
import { getListingByUserId, getUserById } from "@/lib/db";
import SubscribeButton from "@/components/SubscribeButton";
import ManageBillingButton from "@/components/ManageBillingButton";
import ListingForm from "@/components/ListingForm";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const session = await auth();
  const user = session?.user?.id ? await getUserById(session.user.id) : null;
  const { subscribed } = await searchParams;

  if (!user) {
    return (
      <section className="section">
        <div className="container">
          <h2>Dashboard</h2>
          <p>
            <Link href="/login?next=/dashboard">Log in</Link> to see your dashboard.
          </p>
        </div>
      </section>
    );
  }

  const isActive = user.subscription_status === "active";
  const listing = user.role === "boi" ? await getListingByUserId(user.id) : null;

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 780 }}>
        <h2>Your dashboard</h2>
        <p className="muted">
          Signed in as <strong>{user.email}</strong> ·{" "}
          {user.role === "client" ? "🏠 Homeowner" : "🔥 Boi"}
        </p>

        {subscribed === "1" && (
          <div className="success" role="status">
            Welcome aboard — your subscription is being confirmed. If the
            roster still looks locked, give it a minute and refresh.
          </div>
        )}

        <div className="card" style={{ marginTop: 20 }}>
          <h3>Membership</h3>
          <p>
            Status:{" "}
            <strong>
              {isActive
                ? "Active — $20/month"
                : user.subscription_status === "none"
                  ? "Not subscribed yet"
                  : user.subscription_status}
            </strong>
          </p>
          {user.current_period_end && (
            <p className="small muted">
              Current period ends{" "}
              {new Date(user.current_period_end).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            {isActive ? (
              <ManageBillingButton />
            ) : (
              <SubscribeButton
                role={user.role}
                label={`Subscribe — $20/month ${user.role === "client" ? "homeowner" : "boi"}`}
              />
            )}
            {user.role === "client" && isActive && (
              <Link href="/roster" className="btn btn-brand">Browse the roster →</Link>
            )}
          </div>
        </div>

        {user.role === "boi" && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3>Your listing</h3>
            {isActive ? (
              <>
                <p className="muted">
                  This is what homeowners see on the roster. Publish it when
                  you&apos;re ready — you can edit it anytime.
                </p>
                <ListingForm existing={listing} />
              </>
            ) : (
              <p className="muted">
                Subscribe for $20/month to create and publish your listing.
                Once your subscription is active, your listing editor appears
                here.
              </p>
            )}
          </div>
        )}

        {user.role === "client" && !isActive && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3>Browse the roster</h3>
            <p className="muted">
              Subscribe above and the full roster unlocks — photos, vibe,
              looks, city and availability for every boi.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
