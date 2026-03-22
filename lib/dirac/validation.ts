import { z } from "zod";

// ── Gmail ────────────────────────────────────────────────────────────────────

export const GmailSendSchema = z.object({
  to: z.string().min(1).max(500),
  subject: z.string().max(998).optional(),
  body: z.string().min(1).max(100_000),
  threadId: z.string().max(255).optional(),
  messageId: z.string().max(255).optional(),
});

// ── Outlook ──────────────────────────────────────────────────────────────────

export const OutlookSendSchema = z.object({
  to: z.string().max(500).optional(),
  subject: z.string().max(998).optional(),
  body: z.string().min(1).max(100_000),
  messageId: z.string().max(255).optional(),
});

// ── Discord ──────────────────────────────────────────────────────────────────

export const DiscordSendSchema = z.object({
  channelId: z.string().min(1).max(30),
  content: z.string().min(1).max(2000), // Discord message limit
});

// ── Settings ─────────────────────────────────────────────────────────────────

export const SettingsPatchSchema = z.object({
  aiModel: z.string().max(200).optional(),
  aboutMe: z.string().max(5000).optional(),
});

// ── AI Chat ──────────────────────────────────────────────────────────────────

const ConditionalToneSchema = z.object({
  context: z.enum([
    "cold_outreach",
    "client_customer",
    "internal_team",
    "formal_professional",
    "casual_personal",
    "follow_ups",
  ]),
  tone: z.string().max(500),
  formality: z.string().max(200),
  traits: z.array(z.string().max(200)).max(20),
  example_phrases: z.array(z.string().max(500)).max(20),
});

const ToneProfileSchema = z.object({
  summary: z.string().max(1000),
  formality: z.string().max(200),
  traits: z.array(z.string().max(200)).max(20),
  greeting_style: z.string().max(500),
  signoff_style: z.string().max(500),
  example_phrases: z.array(z.string().max(500)).max(20),
  conditional_tones: z.array(ConditionalToneSchema).max(10).optional(),
});

const ContextMessageSchema = z.object({
  from: z.string().max(500),
  body: z.string().max(50_000),
  sentAt: z.string().max(100),
});

const ContextThreadSchema = z.object({
  threadId: z.string().max(255),
  subject: z.string().max(998),
  messages: z.array(ContextMessageSchema).max(200),
  category: z.string().max(50).optional(),
  triage: z.string().max(50).optional(),
  lastMessageAt: z.string().max(100).optional(),
});

export const AiChatSchema = z.object({
  message: z.string().min(1).max(10_000),
  context: z.array(ContextThreadSchema).max(50).optional(),
  toneProfile: ToneProfileSchema.nullable().optional(),
});

// ── Helper ───────────────────────────────────────────────────────────────────

export type ParseOk<T> = { ok: true; data: T };
export type ParseFail = { ok: false; error: string; status: number };
export type ParseResult<T> = ParseOk<T> | ParseFail;

/**
 * Parses and validates a request body against a Zod schema.
 * Narrow with `if (!parsed.ok)` to access `parsed.data` safely.
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join("; ");
    return { ok: false, error: `Validation error: ${message}`, status: 422 };
  }

  return { ok: true, data: result.data };
}
