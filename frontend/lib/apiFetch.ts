/**
 * Attach Supabase access token to API calls against the FastAPI backend.
 */
export function apiFetch(
  input: string | URL,
  accessToken: string | null | undefined,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(input, { ...init, headers });
}
