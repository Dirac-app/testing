import { auth } from "@/lib/dirac/auth";
import { NextResponse } from "next/server";

type AuthGuardResult =
  | { userId: string; error?: never; response?: never }
  | { userId?: never; error: string; response: NextResponse };

/**
 * Validates the current session and returns the authenticated userId.
 * Returns an error response if the user is not authenticated.
 *
 * Usage in API routes:
 *   const guard = await requireAuth();
 *   if (guard.error) return guard.response;
 *   const { userId } = guard;
 */
export async function requireAuth(): Promise<AuthGuardResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      error: "Not authenticated",
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!session.userId) {
    return {
      error: "User ID missing from session",
      response: NextResponse.json({ error: "Session invalid" }, { status: 401 }),
    };
  }

  return { userId: session.userId };
}

/**
 * Lighter auth check — only requires a signed-in user, not a database userId.
 * Use for endpoints that can function without per-user DB state (e.g. AI chat
 * using a global API key).
 */
export async function requireSession(): Promise<
  { userId: string | null; error?: never; response?: never }
  | { userId?: never; error: string; response: NextResponse }
> {
  const session = await auth();

  if (!session?.user) {
    return {
      error: "Not authenticated",
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  return { userId: session.userId ?? null };
}

/**
 * Validates session and that the user has an active Gmail connection.
 */
export async function requireGmail(): Promise<
  AuthGuardResult & { accessToken?: string }
> {
  const session = await auth();

  if (!session?.user) {
    return {
      error: "Not authenticated",
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!session.accessToken) {
    return {
      error: "No Gmail access token",
      response: NextResponse.json({ error: "Gmail not connected" }, { status: 401 }),
    };
  }

  return { userId: session.userId ?? "", accessToken: session.accessToken };
}
