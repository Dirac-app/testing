import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const VALID_TAGS = [
  "billing", "security", "onboarding", "support", "feedback",
  "meeting", "legal", "hiring", "fundraising", "shipping",
  "marketing", "ci_cd", "monitoring", "access", "announcement",
  "intro", "follow_up", "personal",
] as const;

const SYSTEM_PROMPT = `You assign topic tags to email threads. For each thread, pick 1-2 tags from this EXACT list (use underscore versions):

billing — Invoices, payments, subscriptions, pricing
security — Security alerts, password resets, 2FA, breaches
onboarding — Welcome emails, setup guides, getting started
support — Help requests, bug reports, troubleshooting
feedback — User feedback, reviews, NPS, surveys
meeting — Calendar invites, scheduling, availability
legal — Contracts, terms, NDAs, compliance
hiring — Job applications, recruiting, interviews
fundraising — Pitch decks, term sheets, investor updates
shipping — Order confirmations, tracking, delivery
marketing — Newsletters, promotions, product updates
ci_cd — Build notifications, deploy alerts, test results
monitoring — Uptime alerts, error reports, performance
access — Account access, permissions, API keys, invites
announcement — Product launches, company news, policy changes
intro — Introductions, referrals, networking
follow_up — Follow-ups, reminders, check-ins
personal — Non-business, casual, social

Rules:
- Pick ONLY from the list above. Do NOT invent new tags.
- Use the exact strings shown (e.g. "ci_cd" not "CI/CD", "follow_up" not "follow-up").
- Assign 1-2 tags per thread. Most threads need only 1.
- Return ONLY a JSON array (no markdown fences):
[{"threadId": "...", "topics": ["billing"]}]`;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const body = await request.json();
  if (!body.threads?.length) {
    return NextResponse.json({ results: [] });
  }

  const sample = body.threads.slice(0, 25);

  const threadsText = sample
    .map(
      (t: { threadId: string; subject: string; snippet: string; from: string }, i: number) =>
        `${i + 1}. [${t.threadId}] From: ${t.from}\n   Subject: ${t.subject}\n   Snippet: ${t.snippet}`,
    )
    .join("\n\n");

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Dirac",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Assign topic tags to these threads:\n\n${threadsText}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter topics error:", errText);
      return NextResponse.json({ error: "AI topic tagging failed" }, { status: 502 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const validSet = new Set<string>(VALID_TAGS);
    const results = parsed.map((r: { threadId: string; topics: string[] }) => ({
      threadId: r.threadId,
      topics: (r.topics ?? []).filter((t: string) => validSet.has(t)).slice(0, 2),
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Topics error:", err);
    return NextResponse.json({ error: "Failed to assign topics" }, { status: 500 });
  }
}
