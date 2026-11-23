import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getLiveSubscriptionForCustomer } from "@/lib/stripe";
import {
  getApplicationByUserId,
  getBookingsForBoi,
  getBookingsForClient,
  getListingByUserId,
  getUserById,
  hasSignedHomeownerAgreement,
  updateUserSubscriptionByCustomer,
} from "@/lib/db";
import {
  formatCents,
  frequencyLabel,
  serviceLabel,
  timeSlotLabel,
} from "@/lib/pricing";
import SubscribeButton from "@/components/SubscribeButton";
import ManageBillingButton from "@/components/ManageBillingButton";
import ListingForm from "@/components/ListingForm";
import FoundingOffer from "@/components/FoundingOffer";
import HomeownerAgreementSignForm from "@/components/HomeownerAgreementForm";
import BookingList, { type BookingView } from "@/components/BookingList";

function toBookingView(
  b: Awaited<ReturnType<typeof getBookingsForClient>>[number]
): BookingView {
  return {
    id: b.id,
    service_label: serviceLabel(b.service),
    amount: formatCents(b.amount_cents),
    cleaner_amount: formatCents(b.cleaner_amount_cents),
    company_amount: formatCents(b.company_amount_cents),
    date: b.date,
    time_label: timeSlotLabel(b.time_slot),
    frequency_label: frequencyLabel(b.frequency),
    address: b.service_address,
    supplies_by_homeowner: b.supplies_by_homeowner,
    notes: b.notes,
    status: b.status,
    paid: Boolean(b.paid_at),
    refund_status: b.refund_status,
    needs_refund: b.needs_refund,
    client_email: b.client_email,
    boi_display_name: b.boi_display_name,
    boi_city: b.boi_city,
    created_at: b.created_at,
  };
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; booked?: string }>;
}) {
  const session = await auth();
  let user = session?.user?.id ? await getUserById(session.user.id) : null;
  const { subscribed, booked } = await searchParams;

  // Self-heal for the Nov 22 webhook bug (see
  // src/app/api/webhooks/stripe/route.ts): a completed subscription
  // checkout used to store the Checkout Session's "complete" status
  // instead of "active", so a paying subscriber's dashboard kept
  // showing "Not subscribed yet" and the listing editor never
  // appeared. If this user has a Stripe customer id but the row does
  // not say active, ask Stripe whether the subscription is actually
  // live and sync the row. Runs only for non-active subscribers, and
  // a Stripe failure never breaks the dashboard.
  if (user && user.stripe_customer_id && user.subscription_status !== "active") {
    try {
      const live = await getLiveSubscriptionForCustomer(
        user.stripe_customer_id
      );
      if (live) {
        await updateUserSubscriptionByCustomer(user.stripe_customer_id, {
          subscription_status: "active",
          stripe_subscription_id: live.id,
          current_period_end: live.current_period_end ?? undefined,
        });
        user = await getUserById(user.id);
      }
    } catch (err) {
      console.error("subscription resync failed", err);
    }
  }

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
  const bookings =
    user.role === "boi"
      ? (await getBookingsForBoi(user.id)).map(toBookingView)
      : (await getBookingsForClient(user.id)).map(toBookingView);
  // Bois only ever see paid bookings — a request whose checkout was
  // never completed has nothing to confirm and stays invisible to them.
  const boiBookings = bookings.filter(
    (b) => !(b.status === "requested" && !b.paid)
  );

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 780 }}>
        <h2>Your dashboard</h2>
        <p className="muted">
          Signed in as <strong>{user.email}</strong> ·{" "}
          {user.role === "client" ? "🏠 Homeowner" : "🔥 Boi"}
        </p>

        {isAdminEmail(user.email) && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3>Admin</h3>
            <p className="muted">
              Site admin — jump straight to the important stuff.
            </p>
            <div
              style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
            >
              <Link href="/admin" className="btn btn-brand">
                Admin dashboard →
              </Link>
              <Link href="/roster" className="btn btn-ghost">
                Roster →
              </Link>
              <Link href="/admin/applications" className="btn btn-ghost">
                Cleaner applications →
              </Link>
              <Link href="/admin#clients" className="btn btn-ghost">
                Homeowners →
              </Link>
              <Link href="/admin/bookings" className="btn btn-ghost">
                All bookings →
              </Link>
            </div>
          </div>
        )}

        {subscribed === "1" && (
          <div className="success" role="status">
            Welcome aboard — your subscription is being confirmed. If the
            roster still looks locked, give it a minute and refresh.
          </div>
        )}

        {booked === "1" && user.role === "client" && (
          <div className="success" role="status">
            Your clean is booked and paid — your boi will confirm it shortly.
            You&apos;ll see it below, and you can cancel it from here if your
            plans change.
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
          {user.role === "boi" && isApproved && !isActive && (
            <div style={{ marginTop: 12 }}>
              <FoundingOffer />
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            {isActive ? (
              // PayPal has no Customer Portal — subscribers manage or
              // cancel in their PayPal account. Stripe subscribers keep
              // the portal button. Pre-PayPal accounts (null provider)
              // are Stripe accounts.
              user.payment_provider === "paypal" ? (
                <p className="muted small" style={{ margin: 0 }}>
                  Paid with PayPal — manage or cancel your subscription in
                  your PayPal account.
                </p>
              ) : (
                <ManageBillingButton />
              )
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
            <h3>Your bookings</h3>
            <p className="muted">
              Paid bookings show up here — accept or decline each one. Your
              pay is 80% of the cleaning fee, paid biweekly after AZ House
              Bois gets paid.
            </p>
            <div style={{ marginTop: 16 }}>
              <BookingList bookings={boiBookings} view="boi" />
            </div>
          </div>
        )}

        {user.role === "client" && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3>My bookings</h3>
            <p className="muted">
              Cleans you&apos;ve booked and paid for. Cancel here if your
              plans change — if your boi hasn&apos;t confirmed yet, you get
              refunded automatically.
            </p>
            <div style={{ marginTop: 16 }}>
              <BookingList bookings={bookings} view="client" />
            </div>
          </div>
        )}

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
