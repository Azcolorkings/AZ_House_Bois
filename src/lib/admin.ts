/**
 * Admin access for application review.
 * The admin is Steven — gated to one email address so nobody else can
 * approve or deny applications or see the sensitive details in them.
 * Set ADMIN_EMAIL in Vercel env vars; defaults to Steven's email.
 */
export const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "stevendrice2992@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
}
