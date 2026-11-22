import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { listAllUsersForAdmin } from "@/lib/db";
import AdminUserList from "@/components/AdminUserList";

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
