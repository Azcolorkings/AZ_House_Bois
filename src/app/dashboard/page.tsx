import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getApplicationByUserId,
  getListingByUserId,
  getUserById,
  hasSignedHomeownerAgreement,
} from "@/lib/db";
import SubscribeButton from "@/components/SubscribeButton";
import ManageBillingButton from "@/components/ManageBillingButton";
import ListingForm from "@/components/ListingForm";
import HomeownerAgreementSignForm from "@/components/HomeownerAgreementForm";

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
  const application =
    user.role === "boi" ? await getApplicationByUserId(user.id) : null;
  const isApproved = application?.status === "approved";

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

        {user.role === "boi" && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3>Your application</h3>
            {!application && (
              <>
                <p className="muted">
                  Before you can list, fill out the cleaner application — job
                  details, your ID, and the contractor agreement. It costs
                  nothing to apply, and the $20/month listing fee only starts
                  after you&apos;re approved.
                </p>
                <Link href="/apply" className="btn btn-brand">
                  Fill out my application →
                </Link>
              </>
            )}
            {application?.status === "pending" && (
              <p className="muted">
                Your application (as <strong>{application.legal_name}</strong>
                ) is under review. You don&apos;t owe anything while you wait
                — the $20/month listing fee only starts after approval.
              </p>
            )}
            {application?.status === "denied" && (
              <>
                <p className="muted">
                  Your application was not approved. You can apply again with
                  updated information — applying is free.
                </p>
                <Link href="/apply" className="btn btn-brand">
                  Apply again →
                </Link>
              </>
            )}
            {application?.status === "approved" && (
              <p className="muted">
                ✓ Your application is approved. Subscribe below to start your
                $20/month listing.
              </p>
            )}
          </div>
        )}

        {user.role === "client" && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3>Your homeowner agreement</h3>
            {hasSignedHomeownerAgreement(user) ? (
              <p className="muted">
                ✓ Signed
                {user.homeowner_agreement_signature && (
                  <>
                    {" "}
                    as{" "}
                    <strong>{user.homeowner_agreement_signature}</strong>
                  </>
                )}
                {user.homeowner_agreement_signed_at && (
                  <>
                    {" "}
                    on{" "}
                    {new Date(user.homeowner_agreement_signed_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </>
                )}
                . It covers breakage while cleaners are on duty and the
                zero-tolerance rule on harassment.
              </p>
            ) : (
              <>
                <p className="muted">
                  Before you can subscribe or browse the roster, sign the
                  homeowner agreement &amp; waiver. It covers breakage while
                  cleaners are on duty and the zero-tolerance rule on
                  harassment.
                </p>
                <HomeownerAgreementSignForm />
              </>
            )}
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
            ) : user.role === "boi" && !isApproved ? (
              <p className="muted" style={{ margin: 0 }}>
                {application?.status === "pending"
                  ? "Subscribe opens up once your application is approved."
                  : application?.status === "denied"
                    ? "Apply again above — subscribing opens up once an application is approved."
                    : "Apply above first — subscribing opens up once your application is approved."}
              </p>
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
            {isActive && isApproved ? (
              <>
                <p className="muted">
                  This is what homeowners see on the roster. Publish it when
                  you&apos;re ready — you can edit it anytime.
                </p>
                <ListingForm existing={listing} />
              </>
            ) : (
              <p className="muted">
                {isApproved
                  ? "Subscribe for $20/month to create and publish your listing. Once your subscription is active, your listing editor appears here."
                  : "Your listing editor appears here once your application is approved and your $20/month subscription is active."}
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
