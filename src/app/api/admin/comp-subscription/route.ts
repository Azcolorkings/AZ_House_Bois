import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getUserById, setCompSubscription } from "@/lib/db";

/**
 * Admin comp subscription: give a user a free subscription with no
 * Stripe/PayPal charge, or take it back. Gated to ADMIN_EMAIL only.
 *
 * Grant (comp: true) — sets subscription_status 'active' with
 * payment_provider 'comp' and no period end. The user then passes
 * every subscription gate (dashboard, roster, booking) exactly like
 * a paying subscriber, because those gates only check the status.
 * Refuses anyone who already has an active paid subscription — a
 * comp must never sit on top of (or replace) a real payment.
 * Comping the admin's own account is allowed; it is harmless.
 *
 * Remove (comp: false) — only for users whose provider is 'comp';
 * sets the status back to 'none' and clears the provider. A paid
 * subscription is never touched by this route.
 *
 * A comped user has no Stripe customer id and no PayPal subscription
 * id, so neither webhook can ever overwrite the comp: the Stripe
 * webhook updates only WHERE stripe_customer_id = ..., and the
 * PayPal webhook only acts on events for a PayPal subscription id.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "");
    if (!id || typeof body?.comp !== "boolean") {
      return NextResponse.json(
        { error: "Provide an account id and comp true or false." },
        { status: 400 }
      );
    }
    const target = await getUserById(id);
    if (!target) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (body.comp) {
      if (
        target.subscription_status === "active" &&
        target.payment_provider === "comp"
      ) {
        return NextResponse.json({
          ok: true,
          already: true,
          subscription_status: "active",
          payment_provider: "comp",
        });
      }
      if (target.subscription_status === "active") {
        return NextResponse.json(
          {
            error:
              "This account already has an active paid subscription — a comp cannot replace it.",
          },
          { status: 400 }
        );
      }
      const updated = await setCompSubscription(id, true);
      return NextResponse.json({
        ok: true,
        subscription_status: updated?.subscription_status ?? "active",
        payment_provider: "comp",
      });
    }

    if (target.payment_provider !== "comp") {
      return NextResponse.json(
        { error: "This account does not have a comp subscription to remove." },
        { status: 400 }
      );
    }
    const updated = await setCompSubscription(id, false);
    return NextResponse.json({
      ok: true,
      subscription_status: updated?.subscription_status ?? "none",
      payment_provider: updated?.payment_provider ?? null,
    });
  } catch (err) {
    console.error("admin comp subscription error", err);
    return NextResponse.json(
      { error: "Could not update the comp subscription." },
      { status: 500 }
    );
  }
}
