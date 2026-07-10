export const ADMIN_TOKEN_COOKIE = "admin_token";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function sessionCookieOptions(token: string) {
  return {
    name: ADMIN_TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
