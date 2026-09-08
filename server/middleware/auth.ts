import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { get, run } from '../db/database';
import { JWT_SECRET } from '../config';

// Throttle lastSeen updates — once per user per 60s
const lastSeenCache = new Map<string, number>();
const LAST_SEEN_TTL = 60_000;

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of lastSeenCache) {
    if (now - ts > LAST_SEEN_TTL * 10) lastSeenCache.delete(id);
  }
}, 300_000);

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    roles: string[];
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string; roles: string[] };
    
    req.user = decoded;

    // Update lastSeen at most once per minute per user
    const now = Date.now();
    const lastSeen = lastSeenCache.get(decoded.id) || 0;
    if (now - lastSeen > LAST_SEEN_TTL) {
      lastSeenCache.set(decoded.id, now);
      try { run("UPDATE users SET lastSeen = datetime('now') WHERE id = ?", [decoded.id]); } catch {}
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Недействительный токен' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }

    const userRoles = req.user.roles || [req.user.role];
    const hasRole = roles.some(r => userRoles.includes(r));

    if (!hasRole) {
      return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    }

    next();
  };
}

export function generateToken(user: { id: string; username: string; role: string; roles: string[] }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
}
