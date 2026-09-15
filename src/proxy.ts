import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROLE_HOMES, SESSION_COOKIE } from "@/lib/constants";
import { isRoleAllowed, parseSessionCookie } from "@/lib/session";
import type { Role } from "@/lib/types";

const PUBLIC_PATHS = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/upload/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next({ request });
  }

  const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!session && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = ROLE_HOMES[session.role as Role];
    return NextResponse.redirect(url);
  }

  if (session && !isPublic && !isRoleAllowed(session.role, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = ROLE_HOMES[session.role as Role];
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
