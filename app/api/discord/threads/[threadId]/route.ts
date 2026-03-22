import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChannelMessages, mapDiscordMessages } from "@/lib/dirac/discord";

const COOKIE_NAME = "dirac_discord";

/**
 * GET /api/discord/threads/[threadId]
 * Fetches messages for a Discord channel.
 * threadId format: "discord-{channelId}" — we strip the prefix.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return NextResponse.json({ error: "Not connected to Discord" }, { status: 401 });
  }

  // Strip "discord-" prefix to get the actual channel ID
  const channelId = threadId.replace(/^discord-/, "");

  try {
    const messages = await getChannelMessages(channelId, 50);
    const mapped = mapDiscordMessages(messages, channelId);

    return NextResponse.json({ messages: mapped });
  } catch (err) {
    console.error("Discord messages error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Discord messages" },
      { status: 500 },
    );
  }
}
