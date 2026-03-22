import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { getApiKeyForUser } from "@/lib/dirac/user-db";
import { fetchWithTimeout } from "@/lib/dirac/fetch-timeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface ThreadInput {
  id: string;
  subject: string;
  snippet: string;
  lastMessageAt: string;
}

const SYSTEM_PROMPT = `You are a date-urgency classifier. Given a list of email threads (subject, snippet, date) and today's date, determine which threads are urgent.

A thread is urgent if:
- It mentions a specific deadline, due date, or expiry that is within the next 3 days (or overdue)
- It contains time-sensitive language ("ASAP", "urgent", "by end of day", "expires", "deadline", "due", "overdue", "final notice", "last chance", "action required", "time-sensitive")
- It's a meeting/event reminder happening within 24 hours
- It's a payment or billing notice with an imminent due date

A thread is NOT urgent if:
- It's a newsletter, promotional, or marketing email
- It mentions dates far in the future (>3 days out)
- It's a general conversation with no time pressure

Respond with ONLY a JSON array of the thread IDs that are urgent. Example:
["thread-id-1", "thread-id-3"]

If none are urgent, respond with: []`;

/**
 * POST /api/ai/urgency
 * Analyzes threads for date-based urgency.
 * Body: { threads: ThreadInput[] }
 * Returns: { urgentIds: string[] }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = await getApiKeyForUser(session.userId ?? "").catch(() => null) ?? process.env.OPENROUTER_API_KEY ?? null;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured. Please contact support." }, { status: 503 });
  }

  const { threads }: { threads: ThreadInput[] } = await request.json();
  if (!threads || threads.length === 0) {
    return NextResponse.json({ urgentIds: [] });
  }

  const today = new Date().toISOString().split("T")[0];

  const threadList = threads
    .map(
      (t) =>
        `ID: ${t.id}\nSubject: ${t.subject}\nSnippet: ${t.snippet}\nDate: ${t.lastMessageAt}`,
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
            content: `Today's date: ${today}\n\nThreads:\n\n${threadList}`,
          },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ urgentIds: [] });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "[]";

    // Extract JSON array from response (handles markdown fences)
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      return NextResponse.json({ urgentIds: [] });
    }

    const urgentIds: string[] = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ urgentIds });
  } catch (err) {
    console.error("Urgency detection error:", err);
    return NextResponse.json({ urgentIds: [] });
  }
}
