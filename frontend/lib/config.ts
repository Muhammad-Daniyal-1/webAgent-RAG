// Central runtime configuration for the frontend.
// All values are overridable via NEXT_PUBLIC_* env vars so the app can be
// deployed/embedded without editing source. See frontend/.env.example.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
