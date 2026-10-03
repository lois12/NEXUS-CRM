import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { AuthRequest } from './auth';
import { isControlPasswordSet } from '../controllers/controlAuthController';

/**
 * Gate for CONTROL page endpoints.
 * - If no control password is set → allow (open access).
 * - If password is set → require `Authorization: Bearer <control-token>`
 *   (token issued by POST /api/control/auth).
 */
export function controlAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!isControlPasswordSet()) {
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, error: 'Требуется пароль CONTROL', passwordRequired: true });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { scope?: string };
    if (decoded.scope !== 'control') {
      res.status(401).json({ success: false, error: 'Недействительный токен CONTROL', passwordRequired: true });
      return;
    }
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Недействительный токен CONTROL', passwordRequired: true });
  }
}
