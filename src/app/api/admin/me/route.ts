import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

/**
 * Tiny admin check for the admin login page: after signing in, the
 * client asks here whether the signed-in email is the admin email.
 * The check runs server-side so the admin email never leaks to the client.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }
  return NextResponse.json({ isAdmin: isAdminEmail(session.user.email) });
}
