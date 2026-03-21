import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, extractBearerToken } from '@/lib/auth';
import { markCodeUsed, getCodeById } from '@/lib/db';
import { inviteUserToOrg } from '@/lib/github';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authorization token is required' }, { status: 401 });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Invalid or expired session token' }, { status: 401 });
  }

  const existingCode = await getCodeById(session.codeId);
  if (!existingCode) {
    return NextResponse.json({ success: false, error: 'Invite code not found' }, { status: 404 });
  }

  if (existingCode.used) {
    return NextResponse.json({ success: true, alreadyUsed: true, githubUsername: existingCode.github_username });
  }

  let body: { githubUsername?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 }); }

  const { githubUsername } = body;
  if (typeof githubUsername !== 'string' || !githubUsername.trim()) {
    return NextResponse.json({ success: false, error: 'GitHub username is required' }, { status: 400 });
  }

  const username = githubUsername.trim().replace(/^@/, '');
  const inviteResult = await inviteUserToOrg(username);

  if (!inviteResult.success) {
    return NextResponse.json({ success: false, error: inviteResult.error }, { status: 400 });
  }

  await markCodeUsed(session.codeId, username);

  const org = process.env.GITHUB_ORG ?? '';
  return NextResponse.json({
    success: true,
    alreadyMember: inviteResult.alreadyMember ?? false,
    invitationUrl: `https://github.com/orgs/${org}/invitation`,
    repoUrl: 'https://github.com/Dirac-app/Dirac',
  });
}
