/**
 * Thread metadata API.
 * GET  /api/threads/metadata  — fetch all DiracMetadata rows for the current user
 * POST /api/threads/metadata  — batch upsert metadata records
 *
 * The client stores the canonical state in localStorage for instant reads;
 * this endpoint is the DB source of truth used on fresh page loads.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { db } from "@/lib/dirac/db";

// ─── GET ─────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  const userId = session?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db.diracMetadata.findMany({
      where: { userId },
      select: {
        threadId: true,
        status: true,
        tags: true,
        urgencyScore: true,
        snoozedUntil: true,
        isPinned: true,
      },
    });

    return NextResponse.json({ metadata: rows });
  } catch (err) {
    console.error("[threads/metadata] GET failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────

interface MetadataUpsert {
  threadId: string;
  status?: "INBOX" | "DONE" | "SNOOZED" | "ARCHIVED";
  tags?: string[];
  urgencyScore?: number;
  snoozedUntil?: string | null; // ISO date string
  isPinned?: boolean;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { records: MetadataUpsert[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const records = body.records;
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "No records provided" }, { status: 400 });
  }

  try {
    // Use a transaction for atomicity; upsert each record individually since
    // Prisma doesn't support batch upsert with per-row conflict targets.
    await db.$transaction(
      records.slice(0, 100).map((r) => {
        const data: Record<string, unknown> = {};
        if (r.status !== undefined) data.status = r.status;
        if (r.tags !== undefined) data.tags = r.tags;
        if (r.urgencyScore !== undefined) data.urgencyScore = r.urgencyScore;
        if (r.snoozedUntil !== undefined) {
          data.snoozedUntil = r.snoozedUntil ? new Date(r.snoozedUntil) : null;
        }
        if (r.isPinned !== undefined) data.isPinned = r.isPinned;

        return db.diracMetadata.upsert({
          where: { threadId: r.threadId },
          create: {
            threadId: r.threadId,
            userId,
            ...data,
          },
          update: data,
        });
      }),
    );

    return NextResponse.json({ ok: true, count: records.length });
  } catch (err) {
    console.error("[threads/metadata] POST failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
