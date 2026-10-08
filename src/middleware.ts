import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

// Signed-in users who still have a temporary password (e.g. a school account made by an import) can
// only reach the change-password page until they set their own.
export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    if (req.nextauth.token?.mustChange && !path.startsWith("/account/password")) {
      return NextResponse.redirect(new URL("/account/password", req.url));
    }
  },
  { pages: { signIn: "/login" } },
);

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*", "/school/:path*", "/account/:path*"] };
