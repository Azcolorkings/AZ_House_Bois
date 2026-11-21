import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { getListingByUserId, getUserById, upsertListing, getApplicationByUserId } from "@/lib/db";

const LOOKS = ["Classic Boi", "Desert Heat", "Poolside", "Sporty"];

/** Create or update the signed-in boi's own listing. Requires an approved application AND an active boi subscription. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  try {
    const user = await getUserById(session.user.id);
    if (!user || user.role !== "boi") {
      return NextResponse.json(
        { error: "Only boi accounts can post a listing." },
        { status: 403 }
      );
    }
    const app = await getApplicationByUserId(user.id);
    if (!app || app.status !== "approved") {
      return NextResponse.json(
        {
          error:
            "Your cleaner application has to be approved before you can post a listing.",
          code: "application-required",
        },
        { status: 403 }
      );
    }
    if (user.subscription_status !== "active") {
      return NextResponse.json(
        {
          error:
            "An active $20/month boi subscription is required to post your listing.",
          code: "subscription-required",
        },
        { status: 402 }
      );
    }

    const body = await req.json();
    const displayName = String(body?.display_name ?? "").trim();
    const city = String(body?.city ?? "").trim();
    const looks = Array.isArray(body?.looks)
      ? body.looks.filter((l: unknown) => LOOKS.includes(String(l)))
      : [];
    const availability = String(body?.availability ?? "").trim();
    const bio = String(body?.bio ?? "").trim();
    const photoUrl = String(body?.photo_url ?? "").trim() || null;
    const published = body?.published === true;

    if (!displayName || !city || looks.length === 0) {
      return NextResponse.json(
        { error: "Name, city, and at least one look are required." },
        { status: 400 }
      );
    }

    const existing = await getListingByUserId(user.id);
    const listing = await upsertListing(
      existing?.id ?? randomUUID(),
      user.id,
      {
        display_name: displayName,
        city,
        looks,
        availability,
        bio,
        photo_url: photoUrl,
        published,
      }
    );
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    console.error("listing error", err);
    return NextResponse.json(
      { error: "Could not save the listing. Please try again." },
      { status: 500 }
    );
  }
}
