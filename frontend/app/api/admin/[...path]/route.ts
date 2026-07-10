import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/admin/cookies";
import { proxyAdminRequest } from "@/lib/admin/bff";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const { search } = new URL(request.url);
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  return proxyAdminRequest(request, path, search, token);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
