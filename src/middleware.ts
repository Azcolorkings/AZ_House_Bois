import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PROTECTED = ["/roster", "/dashboard", "/apply", "/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  // The admin login page itself must stay public — otherwise nobody
  // could ever reach it to sign in as admin in the first place.
  if (pathname === "/admin/login") return NextResponse.next();
  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (needsAuth && !req.auth?.user) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/roster/:path*", "/dashboard/:path*", "/apply/:path*", "/admin/:path*"],
};
