import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import {
  getThreadMessages,
  markThreadAsRead,
  markThreadAsUnread,
  archiveGmailThread,
  trashGmailThread,
} from "@/lib/dirac/gmail";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const session = await auth();

  if (!session?.accessToken || !session.gmailConnected) {
    return NextResponse.json(
      { error: "Not authenticated with Gmail" },
      { status: 401 },
    );
  }

  const { threadId } = await params;

  try {
    const thread = await getThreadMessages(session.accessToken, threadId);

    // Await mark-as-read so the state is consistent before we return.
    // Non-fatal: log and continue if it fails — don't 500 the thread fetch.
    await markThreadAsRead(session.accessToken, threadId).catch((err) =>
      console.error(`Failed to mark thread ${threadId} as read:`, err),
    );

    return NextResponse.json(thread);
  } catch (error) {
    console.error(`Gmail thread ${threadId} fetch error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch Gmail thread" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/gmail/threads/[threadId]
 * Modify a Gmail thread: mark-read, mark-unread, archive, trash.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const session = await auth();

  if (!session?.accessToken || !session.gmailConnected) {
    return NextResponse.json(
      { error: "Not authenticated with Gmail" },
      { status: 401 },
    );
  }

  const { threadId } = await params;
  const { action } = (await request.json()) as {
    action: "mark-read" | "mark-unread" | "archive" | "trash";
  };

  try {
    switch (action) {
      case "mark-read":
        await markThreadAsRead(session.accessToken, threadId);
        break;
      case "mark-unread":
        await markThreadAsUnread(session.accessToken, threadId);
        break;
      case "archive":
        await archiveGmailThread(session.accessToken, threadId);
        break;
      case "trash":
        await trashGmailThread(session.accessToken, threadId);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`Gmail thread modify error (${action}):`, error);
    return NextResponse.json(
      { error: `Failed to ${action} thread` },
      { status: 500 },
    );
  }
}
