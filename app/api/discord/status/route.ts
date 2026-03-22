import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "dirac_discord";

/**
 * GET /api/discord/status
 * Returns Discord connection status and user info.
 */
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return NextResponse.json({ connected: false });
  }

  try {
    const data = JSON.parse(raw);
    return NextResponse.json({
      connected: true,
      username: data.globalName || data.username,
      userId: data.userId,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

/**
 * DELETE /api/discord/status
 * Disconnects Discord by clearing the cookie.
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
