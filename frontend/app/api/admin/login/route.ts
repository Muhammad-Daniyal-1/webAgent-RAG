import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config";
import { sessionCookieOptions } from "@/lib/admin/cookies";

export async function POST(request: Request) {
  const body = await request.json();

  const backendRes = await fetch(`${API_BASE_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await backendRes.json();

  if (!backendRes.ok) {
    return NextResponse.json(data, { status: backendRes.status });
  }

  const response = NextResponse.json({ email: data.email });
  response.cookies.set(sessionCookieOptions(data.token));
  return response;
}
