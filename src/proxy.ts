import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic guard only: redirects anonymous visitors away from staff pages.
 * Real authentication/authorization happens server-side in every page, action and route handler.
 */
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("attendo_session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/students/:path*", "/subjects/:path*", "/lectures/:path*", "/reports/:path*", "/requests/:path*", "/account/:path*"],
};
