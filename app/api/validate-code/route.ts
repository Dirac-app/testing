import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUnusedCodesWithHashes } from '@/lib/db';
import { issueSessionToken } from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, recordSuccess, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);

  const rateLimitCheck = checkRateLimit(ip);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many failed attempts. Please try again later.', rateLimited: true, resetAt: rateLimitCheck.resetAt.toISOString() },
      { status: 429 }
    );
  }

  let body: { code?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 }); }

  const code = body.code;
  if (typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ success: false, error: 'Invite code is required' }, { status: 400 });
  }

  const trimmedCode = code.trim();
  const unusedCodes = await getUnusedCodesWithHashes();

  let matchedCode: (typeof unusedCodes)[0] | null = null;
  for (const row of unusedCodes) {
    if (await bcrypt.compare(trimmedCode, row.code_hash)) {
      matchedCode = row;
      break;
    }
  }

  if (!matchedCode) {
    const result = recordFailedAttempt(ip);
    const attemptsLeft = result.attemptsRemaining;
    return NextResponse.json(
      { success: false, error: 'Invalid invite code', attemptsRemaining: attemptsLeft, ...(attemptsLeft === 0 && { rateLimited: true, resetAt: result.resetAt.toISOString() }) },
      { status: 401 }
    );
  }

  recordSuccess(ip);
  const sessionToken = issueSessionToken(matchedCode.id, matchedCode.tester_name);
  return NextResponse.json({ success: true, name: matchedCode.tester_name, sessionToken });
}
