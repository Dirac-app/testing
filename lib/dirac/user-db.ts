/**
 * Database helpers for user management, OAuth account persistence,
 * and per-user settings. All token storage goes through here so
 * Supabase has a full audit trail of every connected account.
 */

import { db } from "./db";

const DEFAULT_MODEL = "anthropic/claude-haiku-4-4";

// Allowlist of OpenRouter model slugs users may select.
// Any value outside this list is rejected and replaced with the default.
export const ALLOWED_MODELS = new Set([
  "anthropic/claude-haiku-4-4",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-pro-preview-03-25",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
]);

function sanitizeModel(model: string | undefined | null): string {
  if (!model) return DEFAULT_MODEL;
  return ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
}

// ─── User ────────────────────────────────────────────────

/**
 * Upsert a user row on every sign-in.
 * Returns the internal user ID.
 */
export async function upsertUser(opts: {
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<string> {
  const user = await db.user.upsert({
    where: { email: opts.email },
    create: {
      email: opts.email,
      name: opts.name ?? null,
      avatarUrl: opts.avatarUrl ?? null,
    },
    update: {
      name: opts.name ?? undefined,
      avatarUrl: opts.avatarUrl ?? undefined,
    },
    select: { id: true },
  });
  return user.id;
}

// ─── OAuth Accounts ─────────────────────────────────────

/**
 * Upsert a Gmail OAuth account row.
 * Called from the NextAuth jwt callback when account is present.
 */
export async function upsertGmailAccount(opts: {
  userId: string;
  platformAccountId: string; // the gmail address
  displayName?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  accessTokenExpiresAt?: Date | null;
}): Promise<void> {
  await db.account.upsert({
    where: {
      userId_platform_platformAccountId: {
        userId: opts.userId,
        platform: "GMAIL",
        platformAccountId: opts.platformAccountId,
      },
    },
    create: {
      userId: opts.userId,
      platform: "GMAIL",
      platformAccountId: opts.platformAccountId,
      displayName: opts.displayName ?? null,
      accessToken: opts.accessToken,
      refreshToken: opts.refreshToken ?? null,
      accessTokenExpiresAt: opts.accessTokenExpiresAt ?? null,
    },
    update: {
      accessToken: opts.accessToken,
      refreshToken: opts.refreshToken ?? undefined,
      accessTokenExpiresAt: opts.accessTokenExpiresAt ?? undefined,
      displayName: opts.displayName ?? undefined,
    },
  });
}

/**
 * Upsert an Outlook OAuth account row.
 * Called from the Outlook OAuth callback.
 */
export async function upsertOutlookAccount(opts: {
  userId: string;
  platformAccountId: string; // the outlook/microsoft email
  displayName?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  accessTokenExpiresAt?: Date | null;
}): Promise<void> {
  await db.account.upsert({
    where: {
      userId_platform_platformAccountId: {
        userId: opts.userId,
        platform: "OUTLOOK",
        platformAccountId: opts.platformAccountId,
      },
    },
    create: {
      userId: opts.userId,
      platform: "OUTLOOK",
      platformAccountId: opts.platformAccountId,
      displayName: opts.displayName ?? null,
      accessToken: opts.accessToken,
      refreshToken: opts.refreshToken ?? null,
      accessTokenExpiresAt: opts.accessTokenExpiresAt ?? null,
    },
    update: {
      accessToken: opts.accessToken,
      refreshToken: opts.refreshToken ?? undefined,
      accessTokenExpiresAt: opts.accessTokenExpiresAt ?? undefined,
      displayName: opts.displayName ?? undefined,
    },
  });
}

/**
 * Get a connected Outlook account for a user (most recently updated).
 */
export async function getOutlookAccount(userId: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  platformAccountId: string;
} | null> {
  const account = await db.account.findFirst({
    where: { userId, platform: "OUTLOOK" },
    orderBy: { updatedAt: "desc" },
    select: {
      accessToken: true,
      refreshToken: true,
      accessTokenExpiresAt: true,
      platformAccountId: true,
    },
  });
  if (!account?.accessToken) return null;
  return {
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    accessTokenExpiresAt: account.accessTokenExpiresAt,
    platformAccountId: account.platformAccountId,
  };
}

/**
 * Update Outlook tokens after a refresh.
 */
export async function updateOutlookTokens(opts: {
  userId: string;
  platformAccountId: string;
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt: Date;
}): Promise<void> {
  await db.account.updateMany({
    where: {
      userId: opts.userId,
      platform: "OUTLOOK",
      platformAccountId: opts.platformAccountId,
    },
    data: {
      accessToken: opts.accessToken,
      refreshToken: opts.refreshToken ?? undefined,
      accessTokenExpiresAt: opts.accessTokenExpiresAt,
    },
  });
}

/**
 * Disconnect a platform account for a user.
 */
export async function disconnectAccount(opts: {
  userId: string;
  platform: "GMAIL" | "OUTLOOK";
}): Promise<void> {
  await db.account.deleteMany({
    where: { userId: opts.userId, platform: opts.platform },
  });
}

// ─── User settings ───────────────────────────────────────

/**
 * Get per-user settings, creating defaults if they don't exist yet.
 */
export async function getUserSettings(userId: string): Promise<{
  aiModel: string;
  aboutMe: string | null;
}> {
  const settings = await db.userSettings.upsert({
    where: { userId },
    create: { userId, aiModel: DEFAULT_MODEL },
    update: {},
    select: { aiModel: true, aboutMe: true },
  });
  return settings;
}

/**
 * Update per-user settings.
 */
export async function updateUserSettings(
  userId: string,
  patch: { aiModel?: string; aboutMe?: string },
): Promise<void> {
  const safePatch = {
    ...patch,
    ...(patch.aiModel !== undefined ? { aiModel: sanitizeModel(patch.aiModel) } : {}),
  };
  await db.userSettings.upsert({
    where: { userId },
    create: { userId, aiModel: safePatch.aiModel ?? DEFAULT_MODEL, aboutMe: safePatch.aboutMe ?? null },
    update: safePatch,
  });
}

/**
 * Get the AI model for a user (falls back to env var, then default).
 */
export async function getModelForUser(userId: string): Promise<string> {
  try {
    const settings = await getUserSettings(userId);
    return sanitizeModel(settings.aiModel || process.env.OPENROUTER_MODEL);
  } catch {
    return sanitizeModel(process.env.OPENROUTER_MODEL) || DEFAULT_MODEL;
  }
}

/**
 * Get the OpenRouter API key from server env var.
 */
export async function getApiKeyForUser(_userId: string): Promise<string | null> {
  return process.env.OPENROUTER_API_KEY ?? null;
}
