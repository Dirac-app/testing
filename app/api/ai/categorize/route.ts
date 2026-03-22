import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { getApiKeyForUser } from "@/lib/dirac/user-db";
import { fetchWithTimeout } from "@/lib/dirac/fetch-timeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You categorize emails by relationship type for a solo founder/developer. For each email thread, return exactly one category:

- "investor" — Fundraising, cap table, board updates, investor relations, VC communication
- "customer" — Customer support, feedback, onboarding, user communication
- "vendor" — Service providers: Stripe, AWS, Vercel, domain registrars, hosting, tools
- "outreach" — Cold emails, partnership requests, sales pitches, unsolicited proposals
- "automated" — Machine-generated notifications: GitHub, CI/CD, monitoring, calendar invites, transactional
- "personal" — Everything else: friends, family, personal matters, non-business

Return ONLY a JSON array (no markdown fences):
[{"threadId": "...", "category": "investor" | "customer" | "vendor" | "outreach" | "automated" | "personal"}]`;

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

  const sample = body.threads.slice(0, 25);

  const threadsText = sample
    .map(
      (t: { threadId: string; subject: string; snippet: string; from: string; fromName: string }, i: number) =>
        `${i + 1}. [${t.threadId}] From: ${t.fromName} <${t.from}>\n   Subject: ${t.subject}\n   Snippet: ${t.snippet}`,
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
            content: `Categorize these email threads by relationship type:\n\n${threadsText}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter categorize error:", errText);
      return NextResponse.json(
        { error: "AI categorization failed" },
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
      console.error("Categorize: failed to parse AI JSON:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Categorize error:", err);
    return NextResponse.json(
      { error: "Failed to categorize" },
      { status: 500 },
    );
  }
}
