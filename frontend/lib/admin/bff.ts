import { API_BASE_URL } from "@/lib/config";

export function toBackendPath(segments: string[]): string {
  if (segments.length === 1 && segments[0] === "status") {
    return "/status";
  }
  return `/admin/${segments.join("/")}`;
}

export function backendUrl(segments: string[], search: string): string {
  return `${API_BASE_URL}${toBackendPath(segments)}${search}`;
}

export async function proxyAdminRequest(
  request: Request,
  segments: string[],
  search: string,
  token: string | undefined,
): Promise<Response> {
  if (!token) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const backendRes = await fetch(backendUrl(segments, search), {
    method: request.method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
  });

  const resHeaders = new Headers();
  const ct = backendRes.headers.get("content-type");
  if (ct) resHeaders.set("content-type", ct);

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: resHeaders,
  });
}
