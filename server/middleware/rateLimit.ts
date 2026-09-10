import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil: number | null;
}

const attempts = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const BLOCK_MS = 10 * 60 * 1000;  // 10 minutes

// Cleanup old entries every 5 minutes, cap at 10000 entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now - entry.firstAttempt > WINDOW_MS && (!entry.blockedUntil || now > entry.blockedUntil)) {
      attempts.delete(key);
    }
  }
  // Hard cap: if still too many, delete oldest
  if (attempts.size > 10000) {
    const entries = [...attempts.entries()].sort((a, b) => a[1].firstAttempt - b[1].firstAttempt);
    for (let i = 0; i < entries.length - 5000; i++) attempts.delete(entries[i][0]);
  }
}, 5 * 60 * 1000);

export function rateLimitAuth(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = attempts.get(ip);

  // If blocked, check if block expired
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    const remainingSec = Math.ceil((entry.blockedUntil - now) / 1000);
    const remainingMin = Math.ceil(remainingSec / 60);
    return res.status(429).json({
      success: false,
      error: `Слишком много попыток. Попробуйте через ${remainingMin} мин.`,
      retryAfter: remainingSec,
    });
  }

  // If window expired or block expired, reset
  if (!entry || (now - entry.firstAttempt > WINDOW_MS)) {
    entry = { count: 0, firstAttempt: now, blockedUntil: null };
    attempts.set(ip, entry);
  }

  // Clear block if expired
  if (entry.blockedUntil && now >= entry.blockedUntil) {
    entry.count = 0;
    entry.firstAttempt = now;
    entry.blockedUntil = null;
  }

  next();
}

export function recordFailedAttempt(ip: string) {
  const now = Date.now();
  let entry = attempts.get(ip);

  if (!entry || (now - entry.firstAttempt > WINDOW_MS)) {
    entry = { count: 1, firstAttempt: now, blockedUntil: null };
    attempts.set(ip, entry);
    return;
  }

  entry.count++;

  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
  }
}

export function recordSuccessfulLogin(ip: string) {
  attempts.delete(ip);
}

// ── Registration rate limit: 5 per IP per hour ──

const regAttempts = new Map<string, { count: number; windowStart: number }>();
const REG_MAX = 5;
const REG_WINDOW = 60 * 60 * 1000; // 1 hour

export function rateLimitRegistration(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = regAttempts.get(ip);
  if (!entry || (now - entry.windowStart > REG_WINDOW)) {
    entry = { count: 0, windowStart: now };
    regAttempts.set(ip, entry);
  }

  if (entry.count >= REG_MAX) {
    const retryMin = Math.ceil((REG_WINDOW - (now - entry.windowStart)) / 60000);
    return res.status(429).json({
      success: false,
      error: `Слишком много регистраций. Попробуйте через ${retryMin} мин.`,
    });
  }

  entry.count++;
  next();
}
