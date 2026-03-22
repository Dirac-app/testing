import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const SYNC_COOKIE = "dirac_discord_sync";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * GET /api/discord/sync
 * Returns the list of channel IDs the user has chosen to sync.
 */
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SYNC_COOKIE)?.value;

  if (!raw) {
    return NextResponse.json({ syncedChannels: [] });
  }

  try {
    const data = JSON.parse(raw);
    return NextResponse.json({ syncedChannels: data.syncedChannels ?? [] });
  } catch {
    return NextResponse.json({ syncedChannels: [] });
  }
}

/**
 * PUT /api/discord/sync
 * Saves the user's channel sync preferences.
 * Body: { syncedChannels: string[] }
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const syncedChannels: string[] = body.syncedChannels ?? [];

  const cookieStore = await cookies();
  cookieStore.set(SYNC_COOKIE, JSON.stringify({ syncedChannels }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true, syncedChannels });
}
