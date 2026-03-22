import { NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { listThreads, getThreadMetadata } from "@/lib/dirac/gmail";
import type { DiracThread } from "@/lib/dirac/types";

/**
 * Process an array of tasks with limited concurrency to avoid API rate limits.
 */
async function batchConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
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

export async function GET() {
  const session = await auth();

  if (!session?.accessToken || !session.gmailConnected) {
    return NextResponse.json(
      { error: "Not authenticated with Gmail" },
      { status: 401 },
    );
  }

  try {
    const threadStubs = await listThreads(session.accessToken, 25);

    // Fetch metadata with max 5 concurrent requests to stay under Gmail rate limits
    const threadMetadata = await batchConcurrent(
      threadStubs,
      (stub) => getThreadMetadata(session.accessToken!, stub.id),
      5,
    );

    const threads: DiracThread[] = threadMetadata.map((t) => ({
      id: t.id,
      platform: "GMAIL" as const,
      subject: t.subject,
      snippet: t.snippet,
      isUnread: t.isUnread,
      isStarred: t.isStarred,
      isUrgent: false,
      messageCount: t.messageCount,
      lastMessageAt: t.lastMessageAt,
      participants: t.participants,
      status: "INBOX" as const,
      tags: [],
      isPinned: false,
    }));

    return NextResponse.json({ threads });
  } catch (error) {
    console.error("Gmail threads fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Gmail threads" },
      { status: 500 },
    );
  }
}
