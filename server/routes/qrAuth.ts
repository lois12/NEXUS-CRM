import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { get, run } from '../db/database';
import { authenticateToken, AuthRequest, generateToken } from '../middleware/auth';
import { JWT_SECRET } from '../config';

const router = Router();

// In-memory QR sessions (cleaned up periodically)
interface QRSession {
  id: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
  userId?: string;
  createdAt: number;
  expiresAt: number;
}

const qrSessions = new Map<string, QRSession>();
const QR_TTL = 5 * 60 * 1000; // 5 minutes

// Cleanup expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of qrSessions) {
    if (now > session.expiresAt) {
      qrSessions.delete(id);
    }
  }
}, 60_000);

// Generate QR session token (called by login page)
router.post('/generate', (req: AuthRequest, res: Response) => {
  const id = uuidv4();
  const session: QRSession = {
    id,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + QR_TTL,
  };
  qrSessions.set(id, session);

  // The QR code URL that mobile will open
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const qrUrl = `${baseUrl}/qr-confirm?token=${id}`;

  res.json({ success: true, data: { token: id, url: qrUrl, expiresAt: session.expiresAt } });
});

// Poll QR session status (called by login page every 2s)
router.get('/status/:token', (req: AuthRequest, res: Response) => {
  const { token } = req.params;
  const session = qrSessions.get(token);

  if (!session) {
    return res.json({ success: true, data: { status: 'expired' } });
  }

  if (Date.now() > session.expiresAt) {
    qrSessions.delete(token);
    return res.json({ success: true, data: { status: 'expired' } });
  }

  // If confirmed, return the auth token
  if (session.status === 'confirmed' && session.userId) {
    const user = get('SELECT * FROM users WHERE id = ?', [session.userId]);
    if (user) {
      const roles = user.roles ? user.roles.split(',').map((r: string) => r.trim()) : [user.role];
      const authToken = generateToken({ id: user.id, username: user.username, role: user.role, roles });
      qrSessions.delete(token);
      return res.json({
        success: true,
        data: {
          status: 'confirmed',
          token: authToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            roles,
            avatar: user.avatar,
          },
        },
      });
    }
  }

  res.json({ success: true, data: { status: session.status } });
});

// Mobile scans QR → mark as scanned
router.post('/scan/:token', (req: AuthRequest, res: Response) => {
  const { token } = req.params;
  const session = qrSessions.get(token);

  if (!session || Date.now() > session.expiresAt) {
    return res.status(404).json({ success: false, error: 'QR-код истёк' });
  }

  session.status = 'scanned';
  res.json({ success: true, data: { status: 'scanned' } });
});

// Mobile confirms login (requires auth — user must be logged in on mobile)
router.post('/confirm/:token', authenticateToken, (req: AuthRequest, res: Response) => {
  const { token } = req.params;
  const session = qrSessions.get(token);

  if (!session || Date.now() > session.expiresAt) {
    return res.status(404).json({ success: false, error: 'QR-код истёк' });
  }

  session.status = 'confirmed';
  session.userId = req.user!.id;
  res.json({ success: true, data: { status: 'confirmed' } });
});

export default router;
