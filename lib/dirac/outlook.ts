/**
 * Microsoft Outlook / Graph API helpers.
 * Uses OAuth2 user tokens for all operations.
 */

import { fetchWithTimeout } from "./fetch-timeout";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0/me";
const MS_AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0";

// ─── Types ──────────────────────────────────────────────

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: {
    emailAddress: { name: string; address: string };
  };
  toRecipients: {
    emailAddress: { name: string; address: string };
  }[];
  isRead: boolean;
  receivedDateTime: string;
  sentDateTime?: string;
  hasAttachments: boolean;
}

interface GraphMessageListResponse {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
}

// ─── OAuth2 ─────────────────────────────────────────────

function getRedirectUri(): string {
  const base =
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base}/api/oauth/outlook/callback`;
}

export function getOutlookAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: "openid email profile User.Read Mail.Read Mail.Send Mail.ReadWrite offline_access",
    response_mode: "query",
  });
  return `${MS_AUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeOutlookCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const res = await fetch(`${MS_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID!,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Microsoft token exchange failed: ${body}`);
  }
  return res.json();
}

export async function refreshOutlookToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${MS_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID!,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Microsoft token refresh failed: ${body}`);
  }
  return res.json();
}

// ─── Graph API helpers ──────────────────────────────────

async function graphFetch(accessToken: string, path: string, options?: RequestInit) {
  const res = await fetchWithTimeout(`${GRAPH_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Get user profile (for connection status display).
 */
export async function getOutlookUser(
  accessToken: string,
): Promise<{ displayName: string; mail: string; userPrincipalName?: string }> {
  return graphFetch(accessToken, "");
}

/**
 * List inbox messages grouped by conversationId (threads).
 * Returns the most recent message per conversation thread.
 */
export async function listOutlookThreads(
  accessToken: string,
  top = 25,
): Promise<
  {
    conversationId: string;
    subject: string;
    snippet: string;
    isUnread: boolean;
    lastMessageAt: string;
    from: { name: string; email: string };
  }[]
> {
  // Group by conversationId, keep the most recent message per thread
  const threadMap = new Map<
    string,
    {
      conversationId: string;
      subject: string;
      snippet: string;
      isUnread: boolean;
      lastMessageAt: string;
      from: { name: string; email: string };
      messageCount: number;
    }
  >();

  // Follow nextLink to fetch enough messages to fill `top` unique threads.
  // We stop when we have enough distinct conversations or run out of pages.
  let url: string | undefined =
    `${GRAPH_BASE}/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=id,conversationId,subject,bodyPreview,from,isRead,receivedDateTime`;
  let pages = 0;
  const MAX_PAGES = 4; // cap at 200 raw messages to avoid runaway fetches

  while (url && threadMap.size < top && pages < MAX_PAGES) {
    const data: GraphMessageListResponse = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Graph API ${res.status}: ${await res.text()}`);
      return res.json() as Promise<GraphMessageListResponse>;
    });

    for (const msg of data.value) {
      const existing = threadMap.get(msg.conversationId);
      if (!existing) {
        threadMap.set(msg.conversationId, {
          conversationId: msg.conversationId,
          subject: msg.subject || "(no subject)",
          snippet: msg.bodyPreview || "",
          isUnread: !msg.isRead,
          lastMessageAt: msg.receivedDateTime,
          from: {
            name: msg.from?.emailAddress?.name ?? "Unknown",
            email: msg.from?.emailAddress?.address ?? "",
          },
          messageCount: 1,
        });
      } else {
        existing.messageCount++;
        if (!msg.isRead) existing.isUnread = true;
      }
    }

    url = data["@odata.nextLink"];
    pages++;
  }

  return Array.from(threadMap.values()).slice(0, top);
}

/**
 * Get all messages in a conversation thread.
 */
export async function getOutlookThreadMessages(
  accessToken: string,
  conversationId: string,
): Promise<GraphMessage[]> {
  // Escape single quotes in the OData filter value to prevent filter injection.
  const safeId = conversationId.replace(/'/g, "''");
  const data: GraphMessageListResponse = await graphFetch(
    accessToken,
    `/messages?$filter=conversationId eq '${safeId}'&$orderby=receivedDateTime asc&$top=50&$select=id,conversationId,subject,body,bodyPreview,from,toRecipients,isRead,receivedDateTime,hasAttachments`,
  );
  return data.value;
}

/**
 * Mark a message as read.
 */
export async function markOutlookMessageRead(
  accessToken: string,
  messageId: string,
): Promise<void> {
  await fetch(`${GRAPH_BASE}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isRead: true }),
  });
}

/**
 * Mark a message as unread.
 */
export async function markOutlookMessageUnread(
  accessToken: string,
  messageId: string,
): Promise<void> {
  await fetch(`${GRAPH_BASE}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isRead: false }),
  });
}

/**
 * Move a message to the archive folder (Graph: move to "archive" well-known folder).
 */
export async function archiveOutlookMessage(
  accessToken: string,
  messageId: string,
): Promise<void> {
  await fetch(`${GRAPH_BASE}/messages/${messageId}/move`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ destinationId: "archive" }),
  });
}

/**
 * Move a message to the deleted items folder (trash).
 */
export async function trashOutlookMessage(
  accessToken: string,
  messageId: string,
): Promise<void> {
  await fetch(`${GRAPH_BASE}/messages/${messageId}/move`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ destinationId: "deleteditems" }),
  });
}

/**
 * Send a reply to a message.
 */
export async function sendOutlookReply(
  accessToken: string,
  messageId: string,
  comment: string,
): Promise<void> {
  await fetch(`${GRAPH_BASE}/messages/${messageId}/reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment }),
  });
}

/**
 * Send a new email.
 */
export async function sendOutlookMail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  await fetch(`${GRAPH_BASE}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
}

/**
 * List sent messages from the Sent Items folder.
 */
export async function listOutlookSentMessages(
  accessToken: string,
  top = 20,
): Promise<
  {
    id: string;
    conversationId: string;
    to: string[];
    subject: string;
    snippet: string;
    sentAt: string;
  }[]
> {
  const data: GraphMessageListResponse = await graphFetch(
    accessToken,
    `/mailFolders/sentitems/messages?$top=${top}&$orderby=sentDateTime desc&$select=id,conversationId,subject,bodyPreview,toRecipients,sentDateTime`,
  );

  return data.value.map((msg) => ({
    id: msg.id,
    conversationId: msg.conversationId,
    to: msg.toRecipients?.map((r) => r.emailAddress.address) ?? [],
    subject: msg.subject || "(no subject)",
    snippet: msg.bodyPreview || "",
    sentAt: msg.receivedDateTime,
  }));
}

/**
 * Strip quoted text from an email body (Outlook variant).
 */
function stripOutlookQuotedText(text: string): string {
  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
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
 * Fetch full bodies of recent Outlook sent messages (for tone analysis).
 * Returns only the author's own text with quoted content stripped.
 */
export async function getOutlookSentMessageBodies(
  accessToken: string,
  top = 10,
): Promise<
  {
    to: string[];
    subject: string;
    body: string;
    sentAt: string;
  }[]
> {
  const data: GraphMessageListResponse = await graphFetch(
    accessToken,
    `/mailFolders/sentitems/messages?$top=${top}&$orderby=sentDateTime desc&$select=id,subject,body,toRecipients,sentDateTime`,
  );

  return data.value
    .map((msg) => {
      const rawHtml = msg.body?.content || "";
      const rawText = rawHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const cleanBody = stripOutlookQuotedText(rawText);

      return {
        to: msg.toRecipients?.map((r) => r.emailAddress.address) ?? [],
        subject: msg.subject || "(no subject)",
        body: cleanBody.slice(0, 1500),
        sentAt: msg.receivedDateTime || msg.sentDateTime || "",
      };
    })
    .filter((r) => r.body.length > 10);
}

/**
 * List drafts from the Drafts folder.
 */
export async function listOutlookDrafts(
  accessToken: string,
  top = 20,
): Promise<
  {
    id: string;
    conversationId: string;
    to: string[];
    subject: string;
    snippet: string;
    updatedAt: string;
  }[]
> {
  const data: GraphMessageListResponse = await graphFetch(
    accessToken,
    `/mailFolders/drafts/messages?$top=${top}&$orderby=lastModifiedDateTime desc&$select=id,conversationId,subject,bodyPreview,toRecipients,receivedDateTime`,
  );

  return data.value.map((msg) => ({
    id: msg.id,
    conversationId: msg.conversationId,
    to: msg.toRecipients?.map((r) => r.emailAddress.address) ?? [],
    subject: msg.subject || "(no subject)",
    snippet: msg.bodyPreview || "",
    updatedAt: msg.receivedDateTime,
  }));
}

// ─── Mapping to Dirac types ─────────────────────────────

export function mapOutlookThreadToDirac(thread: {
  conversationId: string;
  subject: string;
  snippet: string;
  isUnread: boolean;
  lastMessageAt: string;
  from: { name: string; email: string };
  messageCount?: number;
}) {
  return {
    id: `outlook-${thread.conversationId}`,
    platform: "OUTLOOK" as const,
    subject: thread.subject,
    snippet: thread.snippet,
    isUnread: thread.isUnread,
    isStarred: false,
    isUrgent: false,
    messageCount: thread.messageCount ?? 1,
    lastMessageAt: thread.lastMessageAt,
    participants: [{ name: thread.from.name, email: thread.from.email }],
    status: "INBOX" as const,
    tags: [] as string[],
    isPinned: false,
  };
}

export function mapOutlookMessageToDirac(msg: GraphMessage) {
  return {
    id: msg.id,
    threadId: `outlook-${msg.conversationId}`,
    fromName: msg.from?.emailAddress?.name ?? "Unknown",
    fromAddress: msg.from?.emailAddress?.address ?? "",
    toAddresses: msg.toRecipients?.map((r) => r.emailAddress.address) ?? [],
    subject: msg.subject,
    bodyText:
      msg.body.contentType === "text" ? msg.body.content : msg.bodyPreview,
    bodyHtml: msg.body.contentType === "html" ? msg.body.content : undefined,
    sentAt: msg.receivedDateTime,
  };
}
