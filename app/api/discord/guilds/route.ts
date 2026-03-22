import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getUserGuilds,
  getBotGuilds,
  getGuildChannels,
} from "@/lib/dirac/discord";

const COOKIE_NAME = "dirac_discord";

interface GuildWithChannels {
  id: string;
  name: string;
  icon: string | null;
  channels: { id: string; name: string; topic?: string }[];
}

/**
 * GET /api/discord/guilds
 * Returns guilds where both the user and the bot are present,
 * including the text channels available in each guild.
 */
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return NextResponse.json({ guilds: [] });
  }

  let discordSession: { accessToken: string };
  try {
    discordSession = JSON.parse(raw);
  } catch {
    return NextResponse.json({ guilds: [] });
  }

  try {
    const [userGuilds, botGuilds] = await Promise.all([
      getUserGuilds(discordSession.accessToken),
      getBotGuilds(),
    ]);

    const userGuildIds = new Set(userGuilds.map((g) => g.id));
    const sharedGuilds = botGuilds.filter((g) => userGuildIds.has(g.id));

    const guildsWithChannels: GuildWithChannels[] = await Promise.all(
      sharedGuilds.map(async (guild) => {
        const channels = await getGuildChannels(guild.id);
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          channels: channels.map((c) => ({
            id: c.id,
            name: c.name ?? "unknown",
            topic: c.topic ?? undefined,
          })),
        };
      }),
    );

    return NextResponse.json({ guilds: guildsWithChannels });
  } catch (err) {
    console.error("Discord guilds error:", err);
    return NextResponse.json({ guilds: [], error: "Failed to fetch guilds" });
  }
}
