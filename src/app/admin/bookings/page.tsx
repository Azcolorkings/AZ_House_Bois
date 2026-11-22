import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getAllBookings } from "@/lib/db";
import {
  formatCents,
  frequencyLabel,
  serviceLabel,
  timeSlotLabel,
} from "@/lib/pricing";

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminBookingsPage() {
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

  const bookings = await getAllBookings();
  const paid = bookings.filter((b) => b.paid_at).length;
  const needsRefund = bookings.filter((b) => b.needs_refund);
  const cleanerOwed = bookings
    .filter((b) => b.status === "confirmed" || b.status === "completed")
    .reduce((sum, b) => sum + b.cleaner_amount_cents, 0);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 960 }}>
        <h2>All bookings</h2>
        <p className="muted">
          Every clean booked through the site. The homeowner pays at booking
          through Stripe; the boi confirms from their dashboard. The split
          is 20% company / 80% cleaner, paid to the cleaner biweekly after
          the company gets paid.
        </p>
        <p>
          <span className="pill">{bookings.length} total</span>{" "}
          <span className="pill">{paid} paid</span>{" "}
          <span className="pill">
            Cleaner pay owed on confirmed cleans: {formatCents(cleanerOwed)}
          </span>
          {needsRefund.length > 0 && (
            <span className="pill" style={{ background: "#fde8e8" }}>
              ⚠️ {needsRefund.length} need a manual refund
            </span>
          )}
        </p>
        <p className="small muted">
          <Link href="/admin">Admin dashboard →</Link>{" "}
          · <Link href="/admin/applications">Cleaner applications →</Link>
        </p>

        {bookings.length === 0 ? (
          <div className="card" style={{ marginTop: 20 }}>
            <p className="muted">No bookings yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
            {bookings.map((b) => (
              <div key={b.id} className="card" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>
                      {serviceLabel(b.service)} — {formatCents(b.amount_cents)}
                    </strong>{" "}
                    <span className="pill">{b.status}</span>
                    {b.needs_refund && (
                      <span className="pill" style={{ background: "#fde8e8" }}>
                        ⚠️ needs manual refund
                      </span>
                    )}
                  </div>
                  <span className="small muted">
                    {fmtDate(b.date)} · {timeSlotLabel(b.time_slot)}
                  </span>
                </div>
                <p className="small" style={{ margin: "8px 0" }}>
                  Homeowner: <strong>{b.client_email}</strong>
                  <br />
                  Boi: <strong>{b.boi_display_name}</strong> · {b.boi_city}
                  <br />
                  Total: {formatCents(b.amount_cents)} · Company 20%:{" "}
                  {formatCents(b.company_amount_cents)} · Cleaner 80%:{" "}
                  {formatCents(b.cleaner_amount_cents)}
                  <br />
                  {frequencyLabel(b.frequency)} · {b.service_address}
                  <br />
                  Supplies:{" "}
                  {b.supplies_by_homeowner
                    ? "Homeowner has their own supplies"
                    : "Boi brings their own supplies"}
                  {b.notes && (
                    <>
                      <br />
                      Notes: {b.notes}
                    </>
                  )}
                  <br />
                  Paid: {b.paid_at ? "yes ✓" : "no — checkout not completed"}
                  {b.paid_at && (
                    <>
                      {" · "}Refund:{" "}
                      {b.refund_status === "refunded"
                        ? "refunded ✓"
                        : b.refund_status === "failed"
                          ? "refund failed — handle in Stripe"
                          : b.refund_status === "not_required"
                            ? "not required"
                            : "none"}
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
