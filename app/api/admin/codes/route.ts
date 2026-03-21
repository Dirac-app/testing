import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { validateAdminSecret } from '@/lib/auth';
import { getAllCodes, insertCode } from '@/lib/db';

const BCRYPT_ROUNDS = 12;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const codes = await getAllCodes();
  return NextResponse.json({ success: true, codes });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { testerName?: unknown; code?: unknown; email?: unknown; notes?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 }); }

  const { testerName, code, email, notes } = body;

  if (typeof testerName !== 'string' || !testerName.trim())
    return NextResponse.json({ success: false, error: 'testerName is required' }, { status: 400 });
  if (typeof code !== 'string' || !code.trim())
    return NextResponse.json({ success: false, error: 'code is required' }, { status: 400 });
  if (code.trim().length < 6)
    return NextResponse.json({ success: false, error: 'Code must be at least 6 characters' }, { status: 400 });

  const emailStr = typeof email === 'string' && email.trim() ? email.trim() : undefined;
  const notesStr = typeof notes === 'string' && notes.trim() ? notes.trim() : undefined;

  try {
    const codeHash = await bcrypt.hash(code.trim(), BCRYPT_ROUNDS);
    const id = await insertCode(codeHash, testerName.trim(), emailStr, notesStr);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error('Error inserting code:', error);
    return NextResponse.json({ success: false, error: 'Failed to create code — it may already exist' }, { status: 409 });
  }
}
