/**
 * In-memory rate limiter for code validation attempts.
 *
 * Design decisions:
 * - Stored in a module-level Map so it persists for the lifetime of the server process.
 * - Resets on server restart (acceptable per spec — this is a lightweight portal).
 * - Each entry tracks attempt count and the window start time.
 * - Window is 15 minutes; after that, the counter resets automatically.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

interface RateLimitEntry {
  attempts: number;
  windowStart: number; // epoch ms
}

// Module-level store — lives for the lifetime of the Node.js process
const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  attemptsRemaining: number;
  resetAt: Date;
}

/**
 * Records a failed attempt for the given IP and checks whether the IP is
 * currently rate-limited.
 *
 * Call this BEFORE processing the request. If allowed === false, reject
 * the request immediately. Only call recordSuccess() when the attempt
 * succeeds so the counter is cleared.
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // No existing entry or window has expired — start a fresh window
    const newEntry: RateLimitEntry = { attempts: 0, windowStart: now };
    store.set(ip, newEntry);
    return {
      allowed: true,
      attemptsRemaining: MAX_ATTEMPTS,
      resetAt: new Date(now + WINDOW_MS),
    };
  }

  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - entry.attempts);
  const resetAt = new Date(entry.windowStart + WINDOW_MS);

  return {
    allowed: entry.attempts < MAX_ATTEMPTS,
    attemptsRemaining,
    resetAt,
  };
}

/**
 * Records a failed validation attempt for the given IP.
 * Must be called after checkRateLimit confirms the request is allowed
 * and the validation itself fails.
 */
export function recordFailedAttempt(ip: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // Start a fresh window with 1 failed attempt
    const newEntry: RateLimitEntry = { attempts: 1, windowStart: now };
    store.set(ip, newEntry);
    return {
      allowed: MAX_ATTEMPTS - 1 > 0,
      attemptsRemaining: MAX_ATTEMPTS - 1,
      resetAt: new Date(now + WINDOW_MS),
    };
  }

  entry.attempts += 1;
  store.set(ip, entry);

  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - entry.attempts);
  return {
    allowed: attemptsRemaining > 0,
    attemptsRemaining,
    resetAt: new Date(entry.windowStart + WINDOW_MS),
  };
}

/**
 * Clears the rate limit record for an IP after a successful validation.
 * Prevents legitimate testers from being locked out after a typo.
 */
export function recordSuccess(ip: string): void {
  store.delete(ip);
}

/**
 * Returns the client IP from a Next.js request.
 * Respects X-Forwarded-For for deployments behind a proxy/load balancer.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For can be a comma-separated list; take the first (client) IP
    return forwarded.split(',')[0].trim();
  }
  // Fallback — in Next.js edge/Node runtime this may not be populated
  return request.headers.get('x-real-ip') || '127.0.0.1';
}
