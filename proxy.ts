import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that don't require an invite code session
const PUBLIC_PATHS = ['/', '/backstage', '/welcome'];
const PUBLIC_PREFIXES = [
  '/api/validate-code',
  '/api/admin',
  '/api/auth',
  '/_next',
  '/favicon',
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  // Allow static files
  if (pathname.includes('.')) return NextResponse.next();

  // Check for invite session cookie
  const token = request.cookies.get('dirac_session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.APP_SECRET ?? 'dev-fallback-secret-change-in-production');
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('dirac_session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
