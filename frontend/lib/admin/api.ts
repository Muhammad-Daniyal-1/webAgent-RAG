"use client";

function toBffUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized.startsWith("/api/admin")) return normalized;
  if (normalized.startsWith("/admin/")) {
    return `/api/admin${normalized.slice("/admin".length)}`;
  }
  return `/api/admin${normalized}`;
}

export async function adminFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const body = init?.body;
  if (
    body &&
    typeof body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(toBffUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
}

export async function adminUpload(
  path: string,
  form: FormData,
): Promise<Response> {
  return fetch(toBffUrl(path), {
    method: "POST",
    credentials: "include",
    body: form,
  });
}

export async function adminLogout(): Promise<void> {
  await fetch("/api/admin/logout", {
    method: "POST",
    credentials: "include",
  });
}
