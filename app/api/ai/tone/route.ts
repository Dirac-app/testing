import { NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { getApiKeyForUser } from "@/lib/dirac/user-db";
import { getSentMessageBodies } from "@/lib/dirac/gmail";
import { getOutlookSentMessageBodies } from "@/lib/dirac/outlook";
import { getOutlookAccessToken } from "@/lib/dirac/outlook-token";
import { fetchWithTimeout } from "@/lib/dirac/fetch-timeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";


const ANALYSIS_PROMPT = `You are a writing style analyst. Below are emails written by one author — ONLY their original text, with quoted replies stripped out. Each email includes Subject and Recipients for context.

Your job: produce a tone profile that captures HOW this person writes, including CONDITIONAL patterns (tone shifts based on audience or situation).

CRITICAL RULES FOR ALL TEXT YOU WRITE:
- NEVER use "they", "this person", "the writer", "the author", "the user", or ANY referring words. Describe the tone itself, not a person.
- Good: "Terse and direct for cold outreach; warm and appreciative for existing relationships."
- Bad: "They are terse with cold emails but warm with customers."
- Keep descriptions tight. No filler.

ANALYSIS STEPS:
1. Classify each email into one of the 6 predefined categories below
2. For each category that has emails, analyze the tone used
3. Identify the baseline/default tone across all emails
4. Look for: formality shifts, greeting/sign-off changes, sentence length differences, vocabulary shifts, warmth levels

THE 6 CONTEXTUAL CATEGORIES (use ONLY these exact context keys):
- "cold_outreach" — Unsolicited emails, first contact, pitching, introducing yourself to strangers
- "client_customer" — Replies to paying customers, clients, or people you provide a service to
- "internal_team" — Messages to teammates, coworkers, collaborators you work closely with
- "formal_professional" — Official/business communication: partners, executives, institutional contacts
- "casual_personal" — Friends, acquaintances, informal conversations, non-work
- "follow_ups" — Reminders, nudges, checking in on previous threads, bumping conversations

Return ONLY a JSON object with this exact shape (no markdown fences, no extra text):
{
  "summary": "1-2 sentence overview of overall style — no referring words",
  "formality": "formal" | "semi-formal" | "casual" | "very-casual",
  "traits": ["trait1", "trait2", "trait3", "trait4"],
  "greeting_style": "Most common opening pattern",
  "signoff_style": "Most common closing pattern",
  "example_phrases": ["verbatim phrase", "another characteristic phrase"],
  "conditional_tones": [
    {
      "context": "cold_outreach" | "client_customer" | "internal_team" | "formal_professional" | "casual_personal" | "follow_ups",
      "tone": "1 sentence describing tone in this context — no referring words",
      "formality": "formal" | "semi-formal" | "casual" | "very-casual",
      "traits": ["trait1", "trait2"],
      "example_phrases": ["verbatim phrase from this context"]
    }
  ]
}

IMPORTANT:
- Only include a conditional_tones entry for a category if you have emails that fit it AND the tone is noticeably different from the default.
- If no emails fit a category, do NOT include it. All 6 are optional.
- If the tone is consistent across all emails, return an empty array for conditional_tones.
- The "context" field MUST be one of the 6 exact keys listed above. No other values.`;

interface SentEmail {
  to: string[];
  subject: string;
  body: string;
  sentAt: string;
}

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = await getApiKeyForUser(session.userId ?? "").catch(() => null) ?? process.env.OPENROUTER_API_KEY ?? null;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key configured. Please contact support." },
      { status: 503 },
    );
  }

  const emails: SentEmail[] = [];

  if (session.accessToken && session.gmailConnected) {
    try {
      const sent = await getSentMessageBodies(session.accessToken, 12);
      emails.push(...sent);
    } catch (err) {
      console.error("Gmail sent fetch for tone:", err);
    }
  }

  const olToken = session.userId ? await getOutlookAccessToken(session.userId) : null;
  if (olToken) {
    try {
      const sent = await getOutlookSentMessageBodies(olToken, 12);
      emails.push(...sent);
    } catch (err) {
      console.error("Outlook sent fetch for tone:", err);
    }
  }

  if (emails.length === 0) {
    return NextResponse.json(
      { error: "No sent emails found. Send some emails first so we can analyze your tone." },
      { status: 404 },
    );
  }

  const sample = emails.slice(0, 12);
  const emailsText = sample
    .map(
      (e, i) =>
        `--- Email ${i + 1} ---\nSubject: ${e.subject}\nTo: ${e.to.join(", ")}\n\n${e.body}`,
    )
    .join("\n\n");

  try {
    const response = await fetchWithTimeout(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Dirac",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: ANALYSIS_PROMPT },
          {
            role: "user",
            content: `Here are my recent sent emails (only my own text, quoted replies stripped):\n\n${emailsText}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter tone analysis error:", errText);
      return NextResponse.json({ error: "AI analysis failed" }, { status: 502 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let profile: unknown;
    try {
      profile = JSON.parse(cleaned);
    } catch {
      console.error("Tone: failed to parse AI JSON:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({ profile, emailCount: sample.length });
  } catch (err) {
    console.error("Tone analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze tone" },
      { status: 500 },
    );
  }
}
