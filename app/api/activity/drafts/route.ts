import { NextResponse } from "next/server";
import { auth } from "@/lib/dirac/auth";
import { listDrafts } from "@/lib/dirac/gmail";
import { listOutlookDrafts } from "@/lib/dirac/outlook";
import { getOutlookAccessToken } from "@/lib/dirac/outlook-token";


export interface DraftItem {
  id: string;
  platform: "GMAIL" | "OUTLOOK";
  to: string[];
  subject: string;
  snippet: string;
  updatedAt: string;
}

export async function GET() {
  const items: DraftItem[] = [];
  const promises: Promise<void>[] = [];

  const session = await auth();
  if (session?.accessToken && session.gmailConnected) {
    promises.push(
      listDrafts(session.accessToken, 20)
        .then((drafts) => {
          for (const d of drafts) {
            items.push({
              id: d.draftId,
              platform: "GMAIL",
              to: d.to,
              subject: d.subject,
              snippet: d.snippet,
              updatedAt: d.updatedAt,
            });
          }
        })
        .catch((err) => console.error("Gmail drafts error:", err)),
    );
  }

  const olToken = session?.userId ? await getOutlookAccessToken(session.userId) : null;
  if (olToken) {
    promises.push(
      listOutlookDrafts(olToken, 20)
        .then((drafts) => {
          for (const d of drafts) {
            items.push({
              id: d.id,
              platform: "OUTLOOK",
              to: d.to,
              subject: d.subject,
              snippet: d.snippet,
              updatedAt: d.updatedAt,
            });
          }
        })
        .catch((err) => console.error("Outlook drafts error:", err)),
    );
  }

  await Promise.allSettled(promises);

  items.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return NextResponse.json({ items });
}
