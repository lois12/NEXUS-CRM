import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { run, query, get } from '../db/database';
import { AuthRequest } from '../middleware/auth';

/** Public PD-subject requests (152-FZ) — no auth */
const router = Router();

const TYPES = new Set(['withdraw', 'delete', 'export', 'correct', 'info']);

router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { type = 'info', contact = '', message = '', page = '' } = req.body || {};
    if (!TYPES.has(String(type))) {
      return res.status(400).json({ success: false, error: 'Неизвестный тип запроса' });
    }
    const c = String(contact || '').trim();
    if (!c || c.length < 5) {
      return res.status(400).json({ success: false, error: 'Укажите контакт для ответа' });
    }
    const id = uuidv4();
    const title = `[ПД:${type}] ${c}`;
    run(
      `INSERT INTO feedback_messages (id, userId, userName, message, page, status)
       VALUES (?, ?, ?, ?, ?, 'new')`,
      [id, null, title.slice(0, 120), `${c}\n${String(message || '').slice(0, 1800)}`, String(page || '/pd-request').slice(0, 200)]
    );

    // notify super admins
    const admins = query(`SELECT id FROM users WHERE role = 'super_admin' OR roles LIKE '%super_admin%'`);
    for (const a of admins) {
      try {
        // lazy import to avoid cycle at load time
        const { createNotification } = require('../controllers/notificationController') as typeof import('../controllers/notificationController');
        createNotification({
          userId: a.id,
          type: 'feedback',
          title: 'Запрос по персональным данным',
          body: `${c} · ${type}`,
          link: '/admin/monitoring',
          relatedId: id,
          senderId: a.id,
        });
      } catch { /* non-fatal */ }
    }

    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('PdRequest error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

export default router;
