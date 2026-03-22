import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { exchangeOutlookCode, getOutlookUser } from "@/lib/dirac/outlook";
import { upsertUser, upsertOutlookAccount } from "@/lib/dirac/user-db";

const base = () =>
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");
  const returnTo = searchParams.get("state") ?? "/settings";

  if (error || !code) {
    console.error("Outlook OAuth error:", error);
    return NextResponse.redirect(`${base()}/settings?outlook_error=auth_failed`);
  }

  try {
    const tokenData = await exchangeOutlookCode(code);
    const msUser    = await getOutlookUser(tokenData.access_token);

    const email       = msUser.mail || msUser.userPrincipalName || "";
    const displayName = msUser.displayName ?? null;

    // Get the current Dirac session to link to existing user,
    // or upsert a new user if signing in fresh via Outlook.
    const session  = await auth();
    const userId   = session?.userId
      ?? (await upsertUser({ email, name: displayName }));

    await upsertOutlookAccount({
      userId,
      platformAccountId: email,
      displayName,
      accessToken:          tokenData.access_token,
      refreshToken:         tokenData.refresh_token ?? null,
      accessTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    });

    // Only allow relative paths — strip protocol-relative or absolute URLs
    const safePath = /^\/[^/]/.test(returnTo) ? returnTo : "/settings";
    return NextResponse.redirect(`${base()}${safePath}?outlook=connected`);
  } catch (err) {
    console.error("Outlook OAuth callback error:", err);
    return NextResponse.redirect(`${base()}/settings?outlook_error=token_exchange`);
  }
}
