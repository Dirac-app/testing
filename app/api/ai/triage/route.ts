import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { getApiKeyForUser } from "@/lib/dirac/user-db";
import { fetchWithTimeout } from "@/lib/dirac/fetch-timeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You classify emails into triage categories. For each email thread, return exactly one category:

- "needs_reply" — Someone is asking a question, making a request, or expecting a response from the user. The user needs to take action.
- "waiting_on" — The user sent the last message and is waiting for someone else to reply.
- "fyi" — Informational email. No action needed. Newsletters, announcements, receipts, confirmations.
- "automated" — Machine-generated notifications. GitHub, CI/CD, monitoring alerts, transactional emails, calendar invites.

Return ONLY a JSON array of objects with this shape (no markdown fences):
[{"threadId": "...", "category": "needs_reply" | "waiting_on" | "fyi" | "automated"}]`;

interface ThreadSummary {
  threadId: string;
  subject: string;
  snippet: string;
  lastSenderIsMe: boolean;
  isUnread: boolean;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = await getApiKeyForUser(session.userId ?? "").catch(() => null) ?? process.env.OPENROUTER_API_KEY ?? null;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured. Please contact support." }, { status: 503 });
  }

  const body: { threads: ThreadSummary[] } = await request.json();
  if (!body.threads?.length) {
    return NextResponse.json({ results: [] });
  }

  const sample = body.threads.slice(0, 20);

  const threadsText = sample
    .map(
      (t, i) =>
        `${i + 1}. [${t.threadId}] Subject: ${t.subject}\n   Snippet: ${t.snippet}\n   Last sender is me: ${t.lastSenderIsMe}\n   Unread: ${t.isUnread}`,
    )
    .join("\n\n");

  try {
    const response = await fetchWithTimeout(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Dirac",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Classify these email threads:\n\n${threadsText}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter triage error:", errText);
      return NextResponse.json(
        { error: "AI classification failed" },
        { status: 502 },
      );
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    let results: unknown;
    try {
      results = JSON.parse(cleaned);
    } catch {
      console.error("Triage: failed to parse AI JSON:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Triage error:", err);
    return NextResponse.json(
      { error: "Failed to classify" },
      { status: 500 },
    );
  }
}
