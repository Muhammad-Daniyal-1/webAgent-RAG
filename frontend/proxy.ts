import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_TOKEN_COOKIE } from "@/lib/admin/cookies";

const ADMIN_LOGIN = "/admin";
const ADMIN_HOME = "/admin/dashboard";

const PROTECTED_ROUTES = [
  "/admin/dashboard",
  "/admin/knowledge",
  "/admin/sessions",
  "/admin/leads",
  "/admin/widget",
  "/admin/account",
];

function isProtectedAdminRoute(pathname: string) {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function hasAdminSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
  return Boolean(token && token.length > 0);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = hasAdminSession(request);

  if (pathname === ADMIN_LOGIN && authed) {
    return NextResponse.redirect(new URL(ADMIN_HOME, request.url));
  }

  if (isProtectedAdminRoute(pathname) && !authed) {
    const loginUrl = new URL(ADMIN_LOGIN, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/dashboard/:path*",
    "/admin/knowledge/:path*",
    "/admin/sessions/:path*",
    "/admin/leads/:path*",
    "/admin/widget/:path*",
    "/admin/account/:path*",
  ],
};
