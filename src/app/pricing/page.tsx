import Link from "next/link";
import SubscribeButton from "@/components/SubscribeButton";

export default function Pricing() {
  return (
    <section className="section">
      <div className="container">
        <h2>Membership — $20/month</h2>
        <p className="muted" style={{ maxWidth: 640 }}>
          Two sides. One roster. Pick yours — cancel anytime from your
          dashboard. Cleaning fees are paid directly between homeowner and
          boi; the membership covers the roster and the listing only.
        </p>
        <div className="grid-2" style={{ marginTop: 28 }}>
          <div className="card">
            <p className="pill">🏠 Homeowner</p>
            <h3 style={{ marginTop: 12 }}>Browse &amp; book the bois</h3>
            <p style={{ fontSize: "2rem", fontWeight: 900, margin: "8px 0" }}>
              $20<span className="muted" style={{ fontSize: "1rem" }}>/month</span>
            </p>
            <ul className="checklist">
              <li>See the full roster — photos, vibe &amp; looks offered</li>
              <li>Filter by city, availability &amp; schedule</li>
              <li>Pick a favorite and book regular cleans directly</li>
              <li>Private browsing — only members see the roster</li>
              <li>Rebook the same boi, manage your clean days</li>
            </ul>
            <div style={{ marginTop: 20 }}>
              <SubscribeButton role="client" label="Subscribe — $20/month" />
            </div>
          </div>
          <div className="card">
            <p className="pill">🔥 Boi</p>
            <h3 style={{ marginTop: 12 }}>List yourself. Get booked.</h3>
            <p style={{ fontSize: "2rem", fontWeight: 900, margin: "8px 0" }}>
              $20<span className="muted" style={{ fontSize: "1rem" }}>/month</span>
            </p>
            <ul className="checklist">
              <li>Apply first — applications are reviewed, and you only pay after you&apos;re approved</li>
              <li>Publish your profile to paying homeowners statewide</li>
              <li>Photos, city, looks &amp; availability on your listing</li>
              <li>Regular, recurring clients — not one-off gigs</li>
              <li>Work independently, earn from cleaning you control</li>
              <li>Early bois get featured placement</li>
            </ul>
            <div style={{ marginTop: 20 }}>
              <SubscribeButton role="boi" label="Subscribe — $20/month" className="btn btn-teal" />
              <p className="small muted" style={{ marginTop: 10 }}>
                Cleaners fill out an application first — the $20/month starts
                only after approval. <Link href="/apply">Apply to clean →</Link>
              </p>
            </div>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: 20 }}>
          Payments are processed securely by Stripe. You&apos;ll create an
          account first, then check out — your membership starts right away
          once payment goes through.
        </p>
      </div>
    </section>
  );
}
