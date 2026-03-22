import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDiscordAuthUrl } from "@/lib/dirac/discord";

const STATE_COOKIE = "dirac_discord_state";

/**
 * GET /api/oauth/discord
 * Redirects the user to Discord OAuth2 authorization.
 * Sets a short-lived httpOnly state cookie for CSRF protection.
 */
export async function GET() {
  const { url, state } = getDiscordAuthUrl();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes — enough to complete OAuth
    path: "/",
  });
  return NextResponse.redirect(url);
}
