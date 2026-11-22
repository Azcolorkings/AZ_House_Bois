import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getAdminAnalytics, listAllUsersForAdmin } from "@/lib/db";
import { formatCents } from "@/lib/pricing";
import AdminUserList from "@/components/AdminUserList";

function fmtDay(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 640 }}>
          <h2>Admin</h2>
          <p>
            This page is for the site admin only.{" "}
            <Link href="/dashboard">Back to your dashboard</Link>.
          </p>
        </div>
      </section>
    );
  }

  const users = await listAllUsersForAdmin();
  const stats = await getAdminAnalytics();
  const clients = users.filter((u) => u.role === "client");
  const bois = users.filter((u) => u.role === "boi");
  const suspended = users.filter((u) => u.suspended).length;
  const paying = users.filter(
    (u) => u.subscription_status === "active"
  ).length;

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 960 }}>
        <h2>Admin dashboard</h2>
        <p className="muted">
          Every account on the site. You browse the roster free — no
          membership needed — and you can suspend any account here. Suspending
          blocks sign-in and kills their live session; nothing is deleted
          and Stripe is never touched.
        </p>

        <h3 style={{ marginTop: 28 }}>Analytics</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <strong>Accounts</strong>
            <p className="small muted" style={{ margin: "8px 0 0", lineHeight: 1.8 }}>
              {stats.accounts.total} total · {stats.accounts.clients} clients ·{" "}
              {stats.accounts.bois} bois
              <br />
              New: {stats.accounts.newLast7Days} in the last 7 days ·{" "}
              {stats.accounts.newLast30Days} in the last 30 days
              <br />
              Suspended: {stats.accounts.suspended}
            </p>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <strong>Applications</strong>
            <p className="small muted" style={{ margin: "8px 0 0", lineHeight: 1.8 }}>
              {stats.applications.pending} pending ·{" "}
              {stats.applications.approved} approved ·{" "}
              {stats.applications.denied} denied
            </p>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <strong>Subscriptions</strong>
            <p className="small muted" style={{ margin: "8px 0 0", lineHeight: 1.8 }}>
              {stats.subscriptions.paying} paying ·{" "}
              {stats.subscriptions.notSubscribed} not subscribed yet
            </p>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <strong>Listings</strong>
            <p className="small muted" style={{ margin: "8px 0 0", lineHeight: 1.8 }}>
              {stats.listings.published} published ·{" "}
              {stats.listings.drafts} unpublished drafts
            </p>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <strong>Bookings</strong>
            <p className="small muted" style={{ margin: "8px 0 0", lineHeight: 1.8 }}>
              {stats.bookings.requested} requested ·{" "}
              {stats.bookings.confirmed} confirmed ·{" "}
              {stats.bookings.declined} declined ·{" "}
              {stats.bookings.cancelled} cancelled ·{" "}
              {stats.bookings.completed} completed
              <br />
              Paid bookings total:{" "}
              {formatCents(stats.bookings.paidTotalCents)}
              <br />
              Company cut earned (20%):{" "}
              {formatCents(stats.bookings.companyEarnedCents)}
              <br />
              Cleaner pay owed on confirmed cleans (80%):{" "}
              {formatCents(stats.bookings.cleanerOwedCents)}
            </p>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <strong>Founding offer</strong>
            <p className="small muted" style={{ margin: "8px 0 0", lineHeight: 1.8 }}>
              {stats.foundingSpotsLeft} of 5 founding spots left
            </p>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <strong>Signups — last 14 days</strong>
          <p className="small muted" style={{ margin: "8px 0 0", lineHeight: 1.8 }}>
            {stats.signupsByDay
              .map((d) => `${fmtDay(d.date)}: ${d.count}`)
              .join(" · ")}
          </p>
        </div>
        <p>
          <span className="pill">{users.length} accounts</span>{" "}
          <span className="pill">{clients.length} clients</span>{" "}
          <span className="pill">{bois.length} bois</span>{" "}
          <span className="pill">{paying} paying</span>{" "}
          {suspended > 0 && (
            <span className="pill" style={{ background: "#fdeceb" }}>
              {suspended} suspended
            </span>
          )}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 20,
          }}
        >
          <Link href="/roster" className="card" style={{ textDecoration: "none", padding: 16 }}>
            <strong>Roster →</strong>
            <p className="small muted" style={{ margin: "6px 0 0" }}>
              Every published boi — free for you, no membership needed.
            </p>
          </Link>
          <Link href="/admin/applications" className="card" style={{ textDecoration: "none", padding: 16 }}>
            <strong>Applications →</strong>
            <p className="small muted" style={{ margin: "6px 0 0" }}>
              Cleaner applications waiting for your approve or deny.
            </p>
          </Link>
          <Link href="/admin#clients" className="card" style={{ textDecoration: "none", padding: 16 }}>
            <strong>Homeowners →</strong>
            <p className="small muted" style={{ margin: "6px 0 0" }}>
              Every client account, subscription and agreement status.
            </p>
          </Link>
          <Link href="/admin/bookings" className="card" style={{ textDecoration: "none", padding: 16 }}>
            <strong>Bookings →</strong>
            <p className="small muted" style={{ margin: "6px 0 0" }}>
              All cleans, totals, and what each cleaner is owed.
            </p>
          </Link>
        </div>
        <p className="small muted">
          <Link href="/admin/applications">Cleaner applications →</Link>{" "}
          · <Link href="/admin/bookings">All bookings →</Link>{" "}
          · <Link href="/roster">View the roster →</Link>
        </p>
        <AdminUserList users={users} />
      </div>
    </section>
  );
}
