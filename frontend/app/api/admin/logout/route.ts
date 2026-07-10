import { NextResponse } from "next/server";
import { ADMIN_TOKEN_COOKIE } from "@/lib/admin/cookies";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_TOKEN_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
