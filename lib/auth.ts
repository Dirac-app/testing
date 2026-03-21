import jwt from 'jsonwebtoken';

/**
 * Returns the JWT signing secret at runtime.
 * Throws at request time (not build time) if APP_SECRET is missing in production.
 */
function getSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APP_SECRET environment variable is required');
    }
    // Development fallback — replace before deploying
    return 'dev-fallback-secret-change-in-production';
  }
  return secret;
}

export interface SessionPayload {
  codeId: number;
  testerName: string;
  iat?: number;
  exp?: number;
}

/**
 * Issues a signed JWT session token after a valid code redemption.
 * Token expires in 24 hours.
 */
export function issueSessionToken(codeId: number, testerName: string): string {
  const payload: SessionPayload = { codeId, testerName };
  return jwt.sign(payload, getSecret(), { expiresIn: '24h' });
}

/**
 * Verifies and decodes a session token.
 * Returns the payload if valid, or null if expired/invalid.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extracts the Bearer token from an Authorization header value.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Validates the admin secret from an Authorization header.
 * Returns true if the header matches ADMIN_SECRET exactly.
 */
export function validateAdminSecret(authHeader: string | null): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('ADMIN_SECRET environment variable is not set');
    return false;
  }
  const token = extractBearerToken(authHeader);
  if (!token) return false;
  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(token, adminSecret);
}

/**
 * Constant-time string comparison to prevent timing-based secret inference.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to prevent length-based timing leaks
    let result = 1;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
