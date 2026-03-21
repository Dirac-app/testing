import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSecret } from '@/lib/auth';
import { deleteCode, getCodeById } from '@/lib/db';

/**
 * DELETE /api/admin/codes/[id]
 * Permanently removes an invite code by ID.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  if (!validateAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid code ID' },
      { status: 400 }
    );
  }

  const existing = getCodeById(id);
  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'Code not found' },
      { status: 404 }
    );
  }

  deleteCode(id);

  return NextResponse.json({ success: true });
}
