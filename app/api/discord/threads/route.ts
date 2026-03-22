import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getChannelMessages,
  getChannel,
  getGuild,
  mapChannelToThread,
} from "@/lib/dirac/discord";

const COOKIE_NAME = "dirac_discord";
const SYNC_COOKIE = "dirac_discord_sync";

/**
 * GET /api/discord/threads
 * Lists Discord channel activity as Dirac threads.
 * Only fetches channels the user has explicitly synced.
 */
export async function GET() {
  const cookieStore = await cookies();
  const discordRaw = cookieStore.get(COOKIE_NAME)?.value;
  const syncRaw = cookieStore.get(SYNC_COOKIE)?.value;

  if (!discordRaw) {
    return NextResponse.json({ threads: [] });
  }

  // Parse synced channel IDs
  let syncedChannels: string[] = [];
  if (syncRaw) {
    try {
      const syncData = JSON.parse(syncRaw);
      syncedChannels = syncData.syncedChannels ?? [];
    } catch {
      // ignore
    }
  }

  if (syncedChannels.length === 0) {
    return NextResponse.json({ threads: [] });
  }

  try {
    // Fetch messages from each synced channel in parallel
    const results = await Promise.allSettled(
      syncedChannels.map(async (channelId) => {
        const [channel, messages] = await Promise.all([
          getChannel(channelId),
          getChannelMessages(channelId, 20),
        ]);

        if (messages.length === 0) return null;

        // Get guild name for the thread subject
        const guild = channel.guild_id
          ? await getGuild(channel.guild_id)
          : null;
        const guildName = guild?.name ?? "Discord";

        return mapChannelToThread(channel, guildName, messages);
      }),
    );

    const threads = results
      .filter(
        (r): r is PromiseFulfilledResult<NonNullable<ReturnType<typeof mapChannelToThread>>> =>
          r.status === "fulfilled" && r.value !== null,
      )
      .map((r) => r.value);

    // Sort by most recent message
    threads.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );

    return NextResponse.json({ threads });
  } catch (err) {
    console.error("Discord threads error:", err);
    return NextResponse.json({ threads: [], error: "Failed to fetch Discord threads" });
  }
}
