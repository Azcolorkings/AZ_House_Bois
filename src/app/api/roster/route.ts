import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublishedListings, getUserById } from "@/lib/db";

/** Published boi listings. Only visible to signed-in clients with an active subscription. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (user.role !== "client" || user.subscription_status !== "active") {
    return NextResponse.json(
      {
        error: "An active $20/month homeowner membership is required to browse the roster.",
        code: "subscription-required",
      },
      { status: 402 }
    );
  }
  const city = new URL(req.url).searchParams.get("city") ?? undefined;
  const listings = await getPublishedListings({ city });
  return NextResponse.json({ listings });
}
