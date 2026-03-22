import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateBody, DiscordSendSchema } from "@/lib/dirac/validation";
import { sendChannelMessage, getChannel, getUserGuilds } from "@/lib/dirac/discord";

const COOKIE_NAME = "dirac_discord";

/**
 * POST /api/discord/send
 * Sends a message to a Discord channel via the bot.
 * Body: { channelId, content }
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return NextResponse.json({ error: "Not connected to Discord" }, { status: 401 });
  }

  let session: { userId: string; accessToken: string };
  try {
    session = JSON.parse(raw);
    if (!session?.accessToken) throw new Error("missing token");
  } catch {
    return NextResponse.json({ error: "Invalid Discord session" }, { status: 401 });
  }

  const parsed = await validateBody(request, DiscordSendSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { channelId, content } = parsed.data;

  try {
    // Verify the channel belongs to a guild the authenticated user is in.
    const [channel, userGuilds] = await Promise.all([
      getChannel(channelId),
      getUserGuilds(session.accessToken),
    ]);

    const userGuildIds = new Set(userGuilds.map((g) => g.id));
    if (!channel.guild_id || !userGuildIds.has(channel.guild_id)) {
      return NextResponse.json({ error: "Not authorised to send to this channel" }, { status: 403 });
    }

    await sendChannelMessage(channelId, content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Discord send error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
