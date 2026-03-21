import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, extractBearerToken } from '@/lib/auth';
import { markCodeUsed, getCodeById } from '@/lib/db';
import { inviteUserToOrg } from '@/lib/github';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Validate session token from Authorization header
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authorization token is required' },
      { status: 401 }
    );
  }

  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired session token' },
      { status: 401 }
    );
  }

  // Verify the code still exists and hasn't been used
  // (guards against double-submission or replay attacks)
  const existingCode = getCodeById(session.codeId);
  if (!existingCode) {
    return NextResponse.json(
      { success: false, error: 'Invite code not found' },
      { status: 404 }
    );
  }

  if (existingCode.used === 1) {
    // Code already used — if they have a valid session token they already joined
    return NextResponse.json(
      {
        success: true,
        alreadyUsed: true,
        githubUsername: existingCode.github_username,
      }
    );
  }

  // Parse and validate request body
  let body: { githubUsername?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { githubUsername } = body;
  if (typeof githubUsername !== 'string' || githubUsername.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'GitHub username is required' },
      { status: 400 }
    );
  }

  const username = githubUsername.trim().replace(/^@/, '');

  // Send GitHub org invitation
  const inviteResult = await inviteUserToOrg(username);

  if (!inviteResult.success) {
    return NextResponse.json(
      { success: false, error: inviteResult.error },
      { status: 400 }
    );
  }

  // Mark the invite code as used now that GitHub invite succeeded
  markCodeUsed(session.codeId, username);

  const org = process.env.GITHUB_ORG ?? '';
  return NextResponse.json({
    success: true,
    alreadyMember: inviteResult.alreadyMember ?? false,
    invitationUrl: `https://github.com/orgs/${org}/invitation`,
    repoUrl: 'https://github.com/Dirac-app/Dirac',
  });
}
