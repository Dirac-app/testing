import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { getApiKeyForUser } from "@/lib/dirac/user-db";
import { fetchWithTimeout } from "@/lib/dirac/fetch-timeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You extract commitments and promises from email threads. A commitment is when someone explicitly says they will do something, often with a deadline.

Look for:
- "I'll send the deck by Thursday"
- "We'll get back to you next week"
- "I can have that ready by end of day"
- "Let me follow up on Monday"
- Deadlines, promises, deliverables

For each commitment found, return:
- "description": Brief description of what was promised
- "owner": "me" if the email author (the user) made the promise, "them" if someone else did
- "dueDate": ISO date string if a deadline is mentioned or can be inferred, null otherwise

Return ONLY a JSON array (no markdown fences). Return [] if no commitments found.
[{"threadId": "...", "description": "...", "owner": "me" | "them", "dueDate": "2025-03-15T00:00:00Z" | null}]`;

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
  if (!body.threads?.length) {
    return NextResponse.json({ results: [] });
  }

  const threadsText = body.threads
    .slice(0, 10)
    .map(
      (t: { threadId: string; subject: string; messages: { from: string; body: string; sentAt: string }[] }, i: number) => {
        const msgs = (t.messages ?? [])
          .map((m) => `  [${m.from}] (${m.sentAt}): ${m.body.slice(0, 500)}`)
          .join("\n");
        return `${i + 1}. [${t.threadId}] Subject: ${t.subject}\n${msgs}`;
      },
    )
    .join("\n\n");

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
            content: `Extract commitments from these email threads:\n\n${threadsText}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter commitments error:", errText);
      return NextResponse.json(
        { error: "AI commitment extraction failed" },
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
      console.error("Commitments: failed to parse AI JSON:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Commitments error:", err);
    return NextResponse.json(
      { error: "Failed to extract commitments" },
      { status: 500 },
    );
  }
}
