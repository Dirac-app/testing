import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeDiscordCode, getDiscordUser } from "@/lib/dirac/discord";

const COOKIE_NAME = "dirac_discord";
const STATE_COOKIE = "dirac_discord_state";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * GET /api/oauth/discord/callback
 * Handles the OAuth2 callback from Discord.
 * Stores user info + tokens in an HTTP-only cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const base = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code) {
    console.error("Discord OAuth error:", error);
    return NextResponse.redirect(`${base}/settings?discord_error=auth_failed`);
  }

  // CSRF check — verify state matches the cookie we set at flow start
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  if (!state || !expectedState || state !== expectedState) {
    console.error("Discord OAuth: state mismatch (possible CSRF)");
    return NextResponse.redirect(`${base}/settings?discord_error=state_mismatch`);
  }

  try {
    const tokenData = await exchangeDiscordCode(code);
    const user = await getDiscordUser(tokenData.access_token);

    // Store identity + user access token (needed for guild membership checks).
    // Refresh token is intentionally excluded — it is not used server-side
    // and reducing cookie surface area limits exposure if cookies are leaked.
    const payload = {
      userId: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    };

    cookieStore.set(COOKIE_NAME, JSON.stringify(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return NextResponse.redirect(`${base}/settings?discord=connected`);
  } catch (err) {
    console.error("Discord OAuth callback error:", err);
    return NextResponse.redirect(`${base}/settings?discord_error=token_exchange`);
  }
}
