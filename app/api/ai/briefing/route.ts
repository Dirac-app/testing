import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { getApiKeyForUser } from "@/lib/dirac/user-db";
import { fetchWithTimeout } from "@/lib/dirac/fetch-timeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You generate a concise morning briefing for a solo founder's inbox. Based on the provided inbox state (threads needing reply, stale threads, snoozed threads resurfacing, commitments due), produce a brief, actionable summary.

Rules:
- Be extremely concise — this should be scannable in 10 seconds
- Prioritize by urgency and staleness
- Mention specific subjects or senders when relevant
- Don't repeat raw data; synthesize it into insight

Return ONLY a JSON object (no markdown fences):
{
  "greeting": "Good morning" | "Good afternoon" | "Good evening",
  "summary": "One sentence overview of inbox state",
  "highlights": ["up to 4 specific action items or highlights"],
  "urgentCount": number,
  "needsReplyCount": number,
  "staleCount": number,
  "commitmentsDueCount": number
}`;

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

  const contextText = `
Inbox state:
- ${body.needsReplyCount ?? 0} threads need your reply
- ${body.waitingOnCount ?? 0} threads you're waiting on
- ${body.staleThreads?.length ?? 0} threads going stale
- ${body.snoozedResurfacing ?? 0} snoozed threads resurfacing today
- ${body.commitmentsDue?.length ?? 0} commitments due today

${body.staleThreads?.length ? `Stale threads:\n${body.staleThreads.map((t: { subject: string; sender: string; staleDays: number }) => `- "${t.subject}" from ${t.sender} (${t.staleDays} days stale)`).join("\n")}` : ""}

${body.commitmentsDue?.length ? `Commitments due:\n${body.commitmentsDue.map((c: { description: string; owner: string }) => `- ${c.owner === "me" ? "You promised" : "They promised"}: ${c.description}`).join("\n")}` : ""}

${body.urgentThreads?.length ? `Urgent:\n${body.urgentThreads.map((t: { subject: string; sender: string }) => `- "${t.subject}" from ${t.sender}`).join("\n")}` : ""}

Current time: ${new Date().toISOString()}
  `.trim();

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
          { role: "user", content: contextText },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter briefing error:", errText);
      return NextResponse.json(
        { error: "AI briefing failed" },
        { status: 502 },
      );
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    let briefing: unknown;
    try {
      briefing = JSON.parse(cleaned);
    } catch {
      console.error("Briefing: failed to parse AI JSON:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json(briefing);
  } catch (err) {
    console.error("Briefing error:", err);
    return NextResponse.json(
      { error: "Failed to generate briefing" },
      { status: 500 },
    );
  }
}
