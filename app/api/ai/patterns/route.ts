import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { getApiKeyForUser } from "@/lib/dirac/user-db";
import { fetchWithTimeout } from "@/lib/dirac/fetch-timeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You analyze email interaction patterns for a solo founder. Given a summary of actions taken on emails from various senders, identify strong patterns the user can automate.

Only suggest a pattern if the confidence is very high (the user does the same thing 80%+ of the time with emails from that sender).

Possible suggested actions:
- "archive" — user archives most emails from this sender
- "star" — user stars most emails from this sender
- "mark_read" — user reads but never replies to emails from this sender
- "mark_urgent" — user always treats emails from this sender as urgent

Return ONLY a JSON array (no markdown fences). Return [] if no strong patterns found.
[{"senderEmail": "...", "senderName": "...", "pattern": "You archive 9 out of 10 emails from this sender", "suggestedAction": "archive" | "star" | "mark_read" | "mark_urgent", "confidence": 0.9}]`;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = await getApiKeyForUser(session.userId ?? "").catch(() => null) ?? process.env.OPENROUTER_API_KEY ?? null;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured. Please contact support." }, { status: 503 });
  }

  const body = await request.json();
  if (!body.senderStats?.length) {
    return NextResponse.json({ results: [] });
  }

  const statsText = body.senderStats
    .slice(0, 20)
    .map(
      (s: {
        email: string;
        name: string;
        totalThreads: number;
        archived: number;
        starred: number;
        replied: number;
        markedUrgent: number;
        markedRead: number;
      }, i: number) =>
        `${i + 1}. ${s.name} <${s.email}>: ${s.totalThreads} threads total — ${s.archived} archived, ${s.starred} starred, ${s.replied} replied, ${s.markedUrgent} marked urgent, ${s.markedRead} read-only`,
    )
    .join("\n");

  try {
    const response = await fetchWithTimeout(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Dirac",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze these sender interaction patterns:\n\n${statsText}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter patterns error:", errText);
      return NextResponse.json(
        { error: "AI pattern detection failed" },
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
      console.error("Patterns: failed to parse AI JSON:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Patterns error:", err);
    return NextResponse.json(
      { error: "Failed to detect patterns" },
      { status: 500 },
    );
  }
}
