/**
 * Gmail REST API helpers.
 * All functions require a valid Google OAuth access token.
 * Uses raw fetch — no googleapis dependency needed.
 */

import { fetchWithTimeout } from "./fetch-timeout";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// ─── Types (Gmail API response shapes) ──────────────────

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType: string;
  headers: GmailHeader[];
  body: { size: number; data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string; // ms since epoch as string
  payload: GmailMessagePart;
}

interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailMessage[];
}

interface GmailThreadListResponse {
  threads?: { id: string; snippet: string; historyId: string }[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

// ─── Helpers ────────────────────────────────────────────

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Decode base64url-encoded body data from Gmail API.
 * Uses Node's native base64url encoding (available since Node 15.13).
 */
function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

/**
 * Recursively extract the plain-text body from a MIME message.
 * Falls back to HTML → stripped text if no text/plain part exists.
 */
function extractBody(part: GmailMessagePart): { text: string; html: string } {
  // Leaf node
  if (!part.parts || part.parts.length === 0) {
    const decoded = part.body.data ? decodeBase64Url(part.body.data) : "";
    if (part.mimeType === "text/plain") return { text: decoded, html: "" };
    if (part.mimeType === "text/html") return { text: "", html: decoded };
    return { text: "", html: "" };
  }

  // Multipart — recurse into children
  let text = "";
  let html = "";
  for (const child of part.parts) {
    const result = extractBody(child);
    if (result.text && !text) text = result.text;
    if (result.html && !html) html = result.html;
  }
  return { text, html };
}

/**
 * Parse "From" header into name + email.
 * Handles: "John Doe <john@example.com>" and "john@example.com"
 */
function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, "").trim(), email: match[2].trim() };
  }
  return { name: from.trim(), email: from.trim() };
}

/**
 * Parse a comma-separated address list into individual emails.
 */
function parseAddresses(value: string): string[] {
  if (!value) return [];
  return value.split(",").map((a) => {
    const m = a.match(/<(.+?)>/);
    return m ? m[1].trim() : a.trim();
  });
}

/**
 * Run async tasks with limited concurrency (avoids Gmail 429 rate limits).
 */
async function batchConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

// ─── Public API ─────────────────────────────────────────

/**
 * Low-level Gmail fetch with:
 *  - fetchWithTimeout (30 s default)
 *  - Exponential backoff on 429 (up to 3 retries: 1 s, 2 s, 4 s)
 *    Honours Retry-After header when present.
 */
async function gmailFetch(
  accessToken: string,
  path: string,
  options?: RequestInit,
) {
  const MAX_RETRIES = 3;
  let delay = 1000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetchWithTimeout(`${GMAIL_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      ...options,
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      // Honour the Retry-After header if provided (value is in seconds)
      const retryAfterHeader = res.headers.get("Retry-After");
      const waitMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : delay;
      await new Promise((r) => setTimeout(r, waitMs));
      delay *= 2; // exponential: 1 s → 2 s → 4 s
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gmail API ${res.status}: ${body}`);
    }
    return res.json();
  }

  // Exhausted retries — surface the rate-limit error
  throw new Error("Gmail API 429: rate limit exceeded after retries");
}

/**
 * Mark a thread as read by removing the UNREAD label from all its messages.
 */
export async function markThreadAsRead(
  accessToken: string,
  threadId: string,
): Promise<void> {
  await fetch(`${GMAIL_BASE}/threads/${threadId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

/**
 * Mark a thread as unread by adding the UNREAD label.
 */
export async function markThreadAsUnread(
  accessToken: string,
  threadId: string,
): Promise<void> {
  await fetch(`${GMAIL_BASE}/threads/${threadId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ addLabelIds: ["UNREAD"] }),
  });
}

/**
 * Archive a thread by removing the INBOX label.
 */
export async function archiveGmailThread(
  accessToken: string,
  threadId: string,
): Promise<void> {
  await fetch(`${GMAIL_BASE}/threads/${threadId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
  });
}

/**
 * Move a thread back to the inbox (unarchive).
 */
export async function unarchiveGmailThread(
  accessToken: string,
  threadId: string,
): Promise<void> {
  await fetch(`${GMAIL_BASE}/threads/${threadId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ addLabelIds: ["INBOX"] }),
  });
}

/**
 * Trash a thread (move to Trash).
 */
export async function trashGmailThread(
  accessToken: string,
  threadId: string,
): Promise<void> {
  await fetch(`${GMAIL_BASE}/threads/${threadId}/trash`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Send a new email or reply to a thread. Builds a minimal RFC 2822 message.
 * If threadId is provided, the message is sent as part of that thread.
 */
export async function sendReply(
  accessToken: string,
  threadId: string | undefined,
  to: string,
  subject: string,
  body: string,
  messageId?: string,
): Promise<void> {
  const isReply = !!threadId && !!messageId;
  const finalSubject = isReply && !subject.startsWith("Re:")
    ? `Re: ${subject}`
    : subject;

  // Build RFC 2822 message
  let raw = `To: ${to}\r\nSubject: ${finalSubject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n`;
  if (messageId) {
    raw += `In-Reply-To: ${messageId}\r\nReferences: ${messageId}\r\n`;
  }
  raw += `\r\n${body}`;

  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const payload: Record<string, string> = { raw: encoded };
  if (threadId) payload.threadId = threadId;

  // Use gmailFetch so HTTP errors are thrown as exceptions
  await gmailFetch(accessToken, "/messages/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * List inbox threads (IDs + snippets). Returns up to `maxResults` threads.
 */
export async function listThreads(
  accessToken: string,
  maxResults = 25,
): Promise<{ id: string; snippet: string }[]> {
  const data: GmailThreadListResponse = await gmailFetch(
    accessToken,
    `/threads?maxResults=${maxResults}&labelIds=INBOX`,
  );
  return data.threads ?? [];
}

/**
 * Get a full thread (all messages with bodies).
 * format=full gives us headers + body parts.
 */
export async function getThread(
  accessToken: string,
  threadId: string,
): Promise<GmailThread> {
  return gmailFetch(accessToken, `/threads/${threadId}?format=full`);
}

/**
 * Fetch thread metadata for list display.
 * Uses format=metadata to avoid downloading full bodies.
 */
export async function getThreadMetadata(
  accessToken: string,
  threadId: string,
): Promise<{
  id: string;
  subject: string;
  snippet: string;
  isUnread: boolean;
  isStarred: boolean;
  messageCount: number;
  lastMessageAt: string;
  participants: { name: string; email: string }[];
}> {
  const data: GmailThread = await gmailFetch(
    accessToken,
    `/threads/${threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
  );

  const messages = data.messages ?? [];
  const firstMsg = messages[0];
  const lastMsg = messages[messages.length - 1];

  const subject = firstMsg
    ? getHeader(firstMsg.payload.headers, "Subject")
    : "(no subject)";

  const isUnread = messages.some((m) => m.labelIds?.includes("UNREAD"));
  const isStarred = messages.some((m) => m.labelIds?.includes("STARRED"));

  // Collect unique participants across all messages
  const participantMap = new Map<string, { name: string; email: string }>();
  for (const msg of messages) {
    const from = getHeader(msg.payload.headers, "From");
    if (from) {
      const parsed = parseFrom(from);
      if (!participantMap.has(parsed.email)) {
        participantMap.set(parsed.email, parsed);
      }
    }
  }

  const lastMessageAt = lastMsg
    ? new Date(Number(lastMsg.internalDate)).toISOString()
    : new Date().toISOString();

  return {
    id: data.id,
    subject: subject || "(no subject)",
    snippet: firstMsg?.snippet ?? "",
    isUnread,
    isStarred,
    messageCount: messages.length,
    lastMessageAt,
    participants: Array.from(participantMap.values()),
  };
}

interface GmailMessageListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

interface GmailDraft {
  id: string;
  message: { id: string; threadId: string };
}

interface GmailDraftListResponse {
  drafts?: GmailDraft[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

/**
 * List sent messages with parsed metadata.
 */
export async function listSentMessages(
  accessToken: string,
  maxResults = 20,
): Promise<
  {
    id: string;
    threadId: string;
    to: string[];
    subject: string;
    snippet: string;
    sentAt: string;
  }[]
> {
  const data: GmailMessageListResponse = await gmailFetch(
    accessToken,
    `/messages?maxResults=${maxResults}&labelIds=SENT`,
  );

  if (!data.messages?.length) return [];

  return batchConcurrent(
    data.messages.slice(0, maxResults),
    async (stub) => {
      const msg: GmailMessage = await gmailFetch(
        accessToken,
        `/messages/${stub.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Date`,
      );
      return {
        id: msg.id,
        threadId: msg.threadId,
        to: parseAddresses(getHeader(msg.payload.headers, "To")),
        subject: getHeader(msg.payload.headers, "Subject") || "(no subject)",
        snippet: msg.snippet,
        sentAt: new Date(Number(msg.internalDate)).toISOString(),
      };
    },
  );
}

/**
 * Strip quoted text from an email body so only the author's original text remains.
 */
function stripQuotedText(text: string): string {
  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    // Stop at common quote markers
    if (/^On .+ wrote:$/i.test(line.trim())) break;
    if (/^-{3,}\s*Original Message\s*-{3,}$/i.test(line.trim())) break;
    if (/^>{1,}\s/.test(line)) continue;
    if (/^From:\s/i.test(line.trim())) break;
    if (/^Sent:\s/i.test(line.trim())) break;
    cleaned.push(line);
  }

  return cleaned.join("\n").trim();
}

/**
 * Fetch full bodies of recent sent messages (for tone analysis).
 * Returns only the author's own text with quoted content stripped.
 */
export async function getSentMessageBodies(
  accessToken: string,
  maxResults = 10,
): Promise<
  {
    to: string[];
    subject: string;
    body: string;
    sentAt: string;
  }[]
> {
  const data: GmailMessageListResponse = await gmailFetch(
    accessToken,
    `/messages?maxResults=${maxResults}&labelIds=SENT`,
  );

  if (!data.messages?.length) return [];

  const results = await batchConcurrent(
    data.messages.slice(0, maxResults),
    async (stub) => {
      const msg: GmailMessage = await gmailFetch(
        accessToken,
        `/messages/${stub.id}?format=full`,
      );
      const headers = msg.payload.headers;
      const bodyParts = extractBody(msg.payload);
      const rawText = bodyParts.text || bodyParts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const cleanBody = stripQuotedText(rawText);

      return {
        to: parseAddresses(getHeader(headers, "To")),
        subject: getHeader(headers, "Subject") || "(no subject)",
        // 1500 chars keeps tone-analysis prompts within token budget while
        // still capturing the full substance of a typical email.
        body: cleanBody.slice(0, 1500),
        sentAt: new Date(Number(msg.internalDate)).toISOString(),
      };
    },
    3,
  );

  return results.filter((r) => r.body.length > 10);
}

/**
 * List drafts with parsed metadata.
 */
export async function listDrafts(
  accessToken: string,
  maxResults = 20,
): Promise<
  {
    id: string;
    draftId: string;
    threadId: string;
    to: string[];
    subject: string;
    snippet: string;
    updatedAt: string;
  }[]
> {
  const data: GmailDraftListResponse = await gmailFetch(
    accessToken,
    `/drafts?maxResults=${maxResults}`,
  );

  if (!data.drafts?.length) return [];

  return batchConcurrent(
    data.drafts.slice(0, maxResults),
    async (draft) => {
      const msg: GmailMessage = await gmailFetch(
        accessToken,
        `/messages/${draft.message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Date`,
      );
      return {
        id: msg.id,
        draftId: draft.id,
        threadId: msg.threadId,
        to: parseAddresses(getHeader(msg.payload.headers, "To")),
        subject: getHeader(msg.payload.headers, "Subject") || "(no subject)",
        snippet: msg.snippet,
        updatedAt: new Date(Number(msg.internalDate)).toISOString(),
      };
    },
  );
}

/**
 * Get full thread with parsed messages (for the thread view).
 */
export async function getThreadMessages(
  accessToken: string,
  threadId: string,
): Promise<{
  id: string;
  subject: string;
  messages: {
    id: string;
    threadId: string;
    fromName: string;
    fromAddress: string;
    toAddresses: string[];
    subject: string;
    bodyText: string;
    bodyHtml: string;
    sentAt: string;
  }[];
}> {
  const data = await getThread(accessToken, threadId);
  const messages = (data.messages ?? []).map((msg) => {
    const headers = msg.payload.headers;
    const from = parseFrom(getHeader(headers, "From"));
    const toRaw = getHeader(headers, "To");
    const body = extractBody(msg.payload);

    return {
      id: msg.id,
      threadId: msg.threadId,
      fromName: from.name,
      fromAddress: from.email,
      toAddresses: parseAddresses(toRaw),
      subject: getHeader(headers, "Subject") || "(no subject)",
      bodyText: body.text,
      bodyHtml: body.html,
      sentAt: new Date(Number(msg.internalDate)).toISOString(),
    };
  });

  const subject = messages[0]?.subject ?? "(no subject)";
  return { id: data.id, subject, messages };
}
