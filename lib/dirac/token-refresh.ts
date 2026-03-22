/**
 * Shared OAuth token refresh utilities.
 * Centralises the network calls for Google and Microsoft token endpoints
 * so auth.ts and outlook-token.ts stay thin.
 *
 * Both functions apply fetchWithTimeout (30 s) and throw on failure.
 */

import { fetchWithTimeout } from "./fetch-timeout";

// ─── Types ───────────────────────────────────────────────

export interface RefreshedToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

// ─── Google ──────────────────────────────────────────────

/**
 * Exchange a Google refresh token for a new access token.
 * Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from the environment.
 */
export async function refreshGoogleToken(
  refreshToken: string,
): Promise<RefreshedToken> {
  const res = await fetchWithTimeout(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google token refresh failed: ${data.error_description ?? data.error ?? res.status}`,
    );
  }

  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string | undefined,
    expires_in: data.expires_in as number,
  };
}

// ─── Microsoft ───────────────────────────────────────────

const MS_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

/**
 * Exchange a Microsoft refresh token for a new access token.
 * Uses AZURE_CLIENT_ID and AZURE_CLIENT_SECRET from the environment.
 */
export async function refreshOutlookToken(
  refreshToken: string,
): Promise<RefreshedToken> {
  const res = await fetchWithTimeout(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID!,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Microsoft token refresh failed: ${data.error_description ?? data.error ?? res.status}`,
    );
  }

  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string | undefined,
    expires_in: data.expires_in as number,
  };
}
