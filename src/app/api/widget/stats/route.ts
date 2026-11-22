import { NextResponse } from "next/server";
import { getAdminAnalytics } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public widget stats for the owner's Android homescreen widget.
 * AGGREGATE COUNTS ONLY — no personal data, no money, no names,
 * no emails, no SSNs, nothing identifiable. Reuses the same
 * getAdminAnalytics() counts as /admin, but returns a small public
 * subset. Cacheable for 60 seconds.
 */
export async function GET() {
  const stats = await getAdminAnalytics();
  return NextResponse.json(
    {
      accounts: stats.accounts.total,
      clients: stats.accounts.clients,
      bois: stats.accounts.bois,
      applicationsPending: stats.applications.pending,
      bookingsRequested: stats.bookings.requested,
      bookingsConfirmed: stats.bookings.confirmed,
      foundingSpotsLeft: stats.foundingSpotsLeft,
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
