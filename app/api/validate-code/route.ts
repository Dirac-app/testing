import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUnusedCodesWithHashes, markCodeUsed } from '@/lib/db';
import { issueSessionToken } from '@/lib/auth';
import {
  checkRateLimit,
  recordFailedAttempt,
  recordSuccess,
  getClientIp,
} from '@/lib/rateLimit';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);

  // Check rate limit before doing any work
  const rateLimitCheck = checkRateLimit(ip);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many failed attempts. Please try again later.',
        rateLimited: true,
        resetAt: rateLimitCheck.resetAt.toISOString(),
      },
      { status: 429 }
    );
  }

  // Parse and validate request body
  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const code = body.code;
  if (typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Invite code is required' },
      { status: 400 }
    );
  }

  const trimmedCode = code.trim();

  // Fetch all unused codes and compare against each hash
  // bcrypt.compare handles the salt extraction automatically
  const unusedCodes = getUnusedCodesWithHashes();

  let matchedCode: (typeof unusedCodes)[0] | null = null;
  for (const row of unusedCodes) {
    const isMatch = await bcrypt.compare(trimmedCode, row.code_hash);
    if (isMatch) {
      matchedCode = row;
      break;
    }
  }

  if (!matchedCode) {
    const result = recordFailedAttempt(ip);
    const attemptsLeft = result.attemptsRemaining;

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid invite code',
        attemptsRemaining: attemptsLeft,
        ...(attemptsLeft === 0 && {
          rateLimited: true,
          resetAt: result.resetAt.toISOString(),
        }),
      },
      { status: 401 }
    );
  }

  // Valid code found — issue session token
  // NOTE: We do NOT mark as used here. The code is marked used only after
  // the GitHub invite step completes, ensuring the tester can retry if GitHub
  // fails. The session token carries the codeId for the next step.
  recordSuccess(ip);

  const sessionToken = issueSessionToken(matchedCode.id, matchedCode.tester_name);

  return NextResponse.json({
    success: true,
    name: matchedCode.tester_name,
    sessionToken,
  });
}
