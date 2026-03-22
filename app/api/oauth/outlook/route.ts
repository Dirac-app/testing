import { NextResponse } from "next/server";
import { getOutlookAuthUrl } from "@/lib/dirac/outlook";

/**
 * GET /api/oauth/outlook
 * Redirects the user to Microsoft OAuth2 authorization.
 */
export async function GET() {
  const url = getOutlookAuthUrl();
  return NextResponse.redirect(url);
}
