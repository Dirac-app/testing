import { NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { listSentMessages } from "@/lib/dirac/gmail";
import { listOutlookSentMessages } from "@/lib/dirac/outlook";
import { getOutlookAccessToken } from "@/lib/dirac/outlook-token";


export interface SentItem {
  id: string;
  platform: "GMAIL" | "OUTLOOK";
  to: string[];
  subject: string;
  snippet: string;
  sentAt: string;
}

export async function GET() {
  const items: SentItem[] = [];
  const promises: Promise<void>[] = [];

  const session = await auth();
  if (session?.accessToken && session.gmailConnected) {
    promises.push(
      listSentMessages(session.accessToken, 20)
        .then((msgs) => {
          for (const m of msgs) {
            items.push({
              id: m.id,
              platform: "GMAIL",
              to: m.to,
              subject: m.subject,
              snippet: m.snippet,
              sentAt: m.sentAt,
            });
          }
        })
        .catch((err) => console.error("Gmail sent error:", err)),
    );
  }

  const olToken = session?.userId ? await getOutlookAccessToken(session.userId) : null;
  if (olToken) {
    promises.push(
      listOutlookSentMessages(olToken, 20)
        .then((msgs) => {
          for (const m of msgs) {
            items.push({
              id: m.id,
              platform: "OUTLOOK",
              to: m.to,
              subject: m.subject,
              snippet: m.snippet,
              sentAt: m.sentAt,
            });
          }
        })
        .catch((err) => console.error("Outlook sent error:", err)),
    );
  }

  await Promise.allSettled(promises);

  items.sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );

  return NextResponse.json({ items });
}
