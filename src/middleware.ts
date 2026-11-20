import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PROTECTED = ["/roster", "/dashboard"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (needsAuth && !req.auth) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/roster/:path*", "/dashboard/:path*"],
};
