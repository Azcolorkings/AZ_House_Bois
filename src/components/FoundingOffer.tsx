import { countFoundingFreeUsed } from "@/lib/db";
import { FOUNDING_FREE_SPOTS } from "@/lib/pricing";

/**
 * Founding-boi offer banner (Nov 21, 2026): the first 5 approved bois
 * get their first month free, then $20/month. Renders nothing once all
 * 5 spots are used. Boi-facing only — never render this on the
 * homeowner/client side.
 */
export default async function FoundingOffer() {
  const used = await countFoundingFreeUsed();
  const remaining = FOUNDING_FREE_SPOTS - used;
  if (remaining <= 0) return null;
  return (
    <div className="success" role="status">
      🔥 <strong>Founding offer:</strong> the first 5 approved bois get
      their first month free, then $20/month.{" "}
      {remaining} of 5 founding spots left.
    </div>
  );
}
