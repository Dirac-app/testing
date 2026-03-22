/**
 * Discord REST API helpers.
 * Uses a Bot token for guild/channel/message access.
 * Uses OAuth2 user token for identity only.
 */

import { fetchWithTimeout } from "./fetch-timeout";

const DISCORD_API = "https://discord.com/api/v10";

// ─── Types ──────────────────────────────────────────────

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  discriminator: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

interface DiscordChannel {
  id: string;
  type: number; // 0 = text, 2 = voice, etc.
  name?: string;
  guild_id?: string;
  topic?: string;
  last_message_id?: string;
}

interface DiscordMessage {
  id: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };
  content: string;
  timestamp: string;
  attachments: { url: string; filename: string }[];
  embeds: { title?: string; description?: string }[];
}

// ─── Helpers ────────────────────────────────────────────

async function discordFetch(
  token: string,
  path: string,
  isBot = true,
) {
  const res = await fetchWithTimeout(`${DISCORD_API}${path}`, {
    headers: {
      Authorization: isBot ? `Bot ${token}` : `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord API ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── OAuth2 ─────────────────────────────────────────────

/**
 * Build the Discord OAuth2 authorization URL.
 * Returns the URL and the state token — the caller must store the state
 * in a short-lived cookie and verify it in the callback.
 */
export function getDiscordAuthUrl(): { url: string; state: string } {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: getDiscordRedirectUri(),
    response_type: "code",
    scope: "identify guilds",
    state,
  });
  return { url: `https://discord.com/oauth2/authorize?${params.toString()}`, state };
}

/**
 * Build the Discord Bot invite URL with required permissions.
 * Permissions: View Channels, Read Message History, Send Messages
 */
export function getDiscordBotInviteUrl(): string {
  const permissions = (
    (1 << 10) | // VIEW_CHANNEL
    (1 << 16) | // READ_MESSAGE_HISTORY
    (1 << 11)   // SEND_MESSAGES
  ).toString();

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    permissions,
    scope: "bot",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function getDiscordRedirectUri(): string {
  const base = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/api/oauth/discord/callback`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeDiscordCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: getDiscordRedirectUri(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord token exchange failed: ${body}`);
  }
  return res.json();
}

/**
 * Get the authenticated Discord user's profile.
 */
export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  return discordFetch(accessToken, "/users/@me", false);
}

/**
 * Get guilds the user is a member of (via user token).
 */
export async function getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  return discordFetch(accessToken, "/users/@me/guilds", false);
}

// ─── Bot API (uses DISCORD_BOT_TOKEN) ───────────────────

const getBotToken = () => process.env.DISCORD_BOT_TOKEN!;

/**
 * Get guilds the bot is in.
 */
export async function getBotGuilds(): Promise<DiscordGuild[]> {
  return discordFetch(getBotToken(), "/users/@me/guilds");
}

/**
 * Get text channels in a guild (via bot token).
 */
export async function getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
  const channels: DiscordChannel[] = await discordFetch(
    getBotToken(),
    `/guilds/${guildId}/channels`,
  );
  // Only return text channels (type 0) and announcement channels (type 5)
  return channels.filter((c) => c.type === 0 || c.type === 5);
}

/**
 * Get recent messages in a channel (via bot token).
 */
export async function getChannelMessages(
  channelId: string,
  limit = 50,
): Promise<DiscordMessage[]> {
  return discordFetch(
    getBotToken(),
    `/channels/${channelId}/messages?limit=${limit}`,
  );
}

/**
 * Get a single channel's info (via bot token).
 */
export async function getChannel(channelId: string): Promise<DiscordChannel> {
  return discordFetch(getBotToken(), `/channels/${channelId}`);
}

/**
 * Get guild info (via bot token).
 */
export async function getGuild(guildId: string): Promise<DiscordGuild> {
  return discordFetch(getBotToken(), `/guilds/${guildId}`);
}

/**
 * Send a message to a channel (via bot token).
 */
export async function sendChannelMessage(
  channelId: string,
  content: string,
): Promise<DiscordMessage> {
  const res = await fetchWithTimeout(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${getBotToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord send failed ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Mapping to Dirac types ─────────────────────────────

/**
 * Map Discord channels to DiracThread format for the unified inbox.
 * Each channel becomes a "thread" in Dirac.
 */
export function mapChannelToThread(
  channel: DiscordChannel,
  guildName: string,
  messages: DiscordMessage[],
): {
  id: string;
  platform: "DISCORD";
  subject: string;
  snippet: string;
  isUnread: false;
  isStarred: false;
  isUrgent: false;
  messageCount: number;
  lastMessageAt: string;
  participants: { name: string; email: string }[];
  status: "INBOX";
  tags: string[];
  isPinned: false;
} {
  const lastMsg = messages[0]; // messages are newest-first from Discord
  const uniqueAuthors = new Map<string, string>();
  for (const msg of messages) {
    if (!uniqueAuthors.has(msg.author.id)) {
      uniqueAuthors.set(
        msg.author.id,
        msg.author.global_name || msg.author.username,
      );
    }
  }

  return {
    id: `discord-${channel.id}`,
    platform: "DISCORD",
    subject: `#${channel.name ?? "channel"} — ${guildName}`,
    snippet: lastMsg?.content?.slice(0, 120) ?? "",
    isUnread: false,
    isStarred: false,
    isUrgent: false,
    messageCount: messages.length,
    lastMessageAt: lastMsg?.timestamp ?? new Date().toISOString(),
    participants: Array.from(uniqueAuthors.entries()).map(([id, name]) => ({
      name,
      email: id, // Use Discord user ID as the "email" field
    })),
    status: "INBOX",
    tags: [guildName],
    isPinned: false,
  };
}

/**
 * Map Discord messages to DiracMessage format.
 */
export function mapDiscordMessages(
  messages: DiscordMessage[],
  channelId: string,
) {
  // Discord returns newest first; reverse for chronological order
  return [...messages].reverse().map((msg) => ({
    id: msg.id,
    threadId: `discord-${channelId}`,
    fromName: msg.author.global_name || msg.author.username,
    fromAddress: msg.author.id,
    toAddresses: [] as string[],
    subject: undefined as string | undefined,
    bodyText: formatDiscordContent(msg),
    bodyHtml: undefined as string | undefined,
    sentAt: msg.timestamp,
  }));
}

function formatDiscordContent(msg: DiscordMessage): string {
  let content = msg.content || "";

  // Append attachment URLs
  if (msg.attachments.length > 0) {
    const attachmentLines = msg.attachments.map(
      (a) => `[${a.filename}](${a.url})`,
    );
    content += (content ? "\n\n" : "") + attachmentLines.join("\n");
  }

  // Append embed info
  if (msg.embeds.length > 0) {
    for (const embed of msg.embeds) {
      if (embed.title) content += (content ? "\n\n" : "") + `**${embed.title}**`;
      if (embed.description) content += "\n" + embed.description;
    }
  }

  return content || "(no content)";
}
