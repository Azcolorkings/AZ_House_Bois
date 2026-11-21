import Link from "next/link";
import { auth } from "@/lib/auth";
import { getApplicationByUserId, getUserById } from "@/lib/db";
import ApplicationForm from "@/components/ApplicationForm";
import FoundingOffer from "@/components/FoundingOffer";

export default async function ApplyPage() {
  const session = await auth();
  const user = session?.user?.id ? await getUserById(session.user.id) : null;

  if (!user) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 640 }}>
          <h2>Apply to clean</h2>
          <p>
            <Link href="/login?next=/apply">Log in</Link> to fill out your
            cleaner application.
          </p>
        </div>
      </section>
    );
  }

  if (user.role !== "boi") {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 640 }}>
          <h2>Apply to clean</h2>
          <p>
            This application is for cleaners (bois) only. Homeowners
            don&apos;t need to apply —{" "}
            <Link href="/pricing">subscribe for $20/month</Link> to browse the
            roster.
          </p>
        </div>
      </section>
    );
  }

  const app = await getApplicationByUserId(user.id);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 680 }}>
        <h2>Cleaner application</h2>
        <p className="muted">
          Fill this out to become a contracted cleaner on AZ House Bois. We
          review every application — you&apos;ll hear back on your dashboard.
        </p>

        <div style={{ marginTop: 16 }}>
          <FoundingOffer />
        </div>

        {app?.status === "pending" && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3>Application under review</h3>
            <p>
              You applied as <strong>{app.legal_name}</strong>. We&apos;re
              looking it over — check your dashboard for the decision. You
              don&apos;t owe anything while you wait.
            </p>
            <p className="small muted">
              Submitted{" "}
              {new Date(app.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              .
            </p>
          </div>
        )}

        {app?.status === "approved" && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3>You&apos;re approved ✓</h3>
            <p>
              Your application was approved. The next step is the $20/month
              listing fee — subscribe from your dashboard and your listing
              editor unlocks.
            </p>
            <Link href="/dashboard" className="btn btn-brand">
              Go to your dashboard →
            </Link>
          </div>
        )}

        {app?.status === "denied" && (
          <div style={{ marginTop: 20 }}>
            <div className="error" role="status">
              Your last application was not approved. You can apply again with
              updated information below — you still owe nothing unless a new
              application is approved.
            </div>
            <div style={{ marginTop: 20 }}>
              <ApplicationForm />
            </div>
          </div>
        )}

        {!app && (
          <div className="card" style={{ marginTop: 20 }}>
            <ApplicationForm />
          </div>
        )}
      </div>
    </section>
  );
}
