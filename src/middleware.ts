// Route protection for role portals (AR-2). Server-side guards in each layout and API route
// re-check the session against the database (NFR-1); this layer just routes users quickly.
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, verifyAccessToken } from "./lib/jwt";
import { ROLE_HOME, type Role } from "./lib/constants";

const PORTALS: { prefix: string; role: Role }[] = [
  { prefix: "/student", role: "STUDENT" },
  { prefix: "/college", role: "COLLEGE" },
  { prefix: "/mentor", role: "MENTOR" },
  { prefix: "/admin", role: "ADMIN" },
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const portal = PORTALS.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"));
  if (!portal) return NextResponse.next();

  const claims = await verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value);
  if (claims) {
    if (claims.role === portal.role) return NextResponse.next();
    const home = ROLE_HOME[claims.role];
    return NextResponse.redirect(new URL(home ?? "/login", req.url));
  }

  const next = encodeURIComponent(pathname + search);
  const target = req.cookies.get(REFRESH_COOKIE)?.value ? `/restore?next=${next}` : `/login?next=${next}`;
  return NextResponse.redirect(new URL(target, req.url));
}

export const config = {
  matcher: ["/student/:path*", "/college/:path*", "/mentor/:path*", "/admin/:path*"],
};
