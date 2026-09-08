import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { getVapidPublicKey, saveSubscription, removeSubscription } from '../utils/push';

const router = Router();

// Get VAPID public key
router.get('/vapid-key', (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { publicKey: getVapidPublicKey() } });
});

// Save push subscription
router.post('/subscribe', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ success: false, error: 'Неверная подписка' });
    }
    saveSubscription(req.user!.id, subscription, req.get('user-agent') || '');
    res.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Remove push subscription
router.post('/unsubscribe', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ success: false, error: 'endpoint обязателен' });
    removeSubscription(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

export default router;
