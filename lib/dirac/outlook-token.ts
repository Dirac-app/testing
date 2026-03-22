/**
 * Get a valid Outlook access token for a user from the DB.
 * Automatically refreshes if expired and persists the new token.
 */

import { getOutlookAccount, updateOutlookTokens } from "@/lib/dirac/user-db";
import { refreshOutlookToken } from "@/lib/dirac/token-refresh";

export async function getOutlookAccessToken(userId: string): Promise<string | null> {
  const account = await getOutlookAccount(userId);
  if (!account) return null;

  const expiresAt = account.accessTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt > 0 && Date.now() > expiresAt - 60_000;

  if (!needsRefresh) return account.accessToken;

  if (!account.refreshToken) return null;

  try {
    const refreshed = await refreshOutlookToken(account.refreshToken);
    const newExpiry  = new Date(Date.now() + refreshed.expires_in * 1000);

    await updateOutlookTokens({
      userId,
      platformAccountId:   account.platformAccountId,
      accessToken:         refreshed.access_token,
      refreshToken:        refreshed.refresh_token ?? account.refreshToken,
      accessTokenExpiresAt: newExpiry,
    });

    return refreshed.access_token;
  } catch (err) {
    console.error("[outlook-token] refresh failed:", err);
    return null;
  }
}
