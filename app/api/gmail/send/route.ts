import { NextRequest, NextResponse } from "next/server";
import { requireGmail } from "@/lib/dirac/auth-guard";
import { validateBody, GmailSendSchema } from "@/lib/dirac/validation";
import { sendReply } from "@/lib/dirac/gmail";

/**
 * POST /api/gmail/send
 * Sends a new email or a reply to a Gmail thread.
 * Body: { threadId?, to, subject, body, messageId? }
 */
export async function POST(request: NextRequest) {
  const guard = await requireGmail();
  if (guard.error) return guard.response;

  const parsed = await validateBody(request, GmailSendSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { threadId, to, subject, body, messageId } = parsed.data;

  try {
    await sendReply(
      guard.accessToken!,
      threadId ?? undefined,
      to,
      subject ?? "",
      body,
      messageId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Gmail send error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
