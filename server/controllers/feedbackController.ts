import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './notificationController';

/** Any logged-in user sends feedback → admin inbox */
export const createFeedback = (req: AuthRequest, res: Response) => {
  try {
    const { message, page } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: 'Сообщение пустое' });
    }
    const id = uuidv4();
    const userId = req.user!.id;
    const userName = req.user!.username || '';
    run(
      `INSERT INTO feedback_messages (id, userId, userName, message, page) VALUES (?, ?, ?, ?, ?)`,
      [id, userId, userName, String(message).trim().slice(0, 2000), String(page || '').slice(0, 200)]
    );

    // Notify super admins
    const admins = query(`SELECT id FROM users WHERE role = 'super_admin' OR roles LIKE '%super_admin%'`);
    for (const a of admins) {
      if (a.id === userId) continue;
      createNotification({
        userId: a.id,
        type: 'feedback',
        title: 'Обратная связь',
        body: `${userName}: ${String(message).trim().slice(0, 80)}`,
        link: '/admin/monitoring',
        relatedId: id,
        senderId: userId,
      });
    }

    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('CreateFeedback error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const listFeedback = (req: AuthRequest, res: Response) => {
  try {
    const rows = query(`SELECT * FROM feedback_messages ORDER BY createdAt DESC LIMIT 200`);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('ListFeedback error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const resolveFeedback = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const row = get('SELECT * FROM feedback_messages WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, error: 'Не найдено' });
    const status = row.status === 'resolved' ? 'new' : 'resolved';
    run(
      `UPDATE feedback_messages SET status = ?, resolvedAt = ${status === 'resolved' ? "datetime('now')" : 'NULL'} WHERE id = ?`,
      [status, id]
    );
    res.json({ success: true, data: { id, status } });
  } catch (error) {
    console.error('ResolveFeedback error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteFeedback = (req: AuthRequest, res: Response) => {
  try {
    run('DELETE FROM feedback_messages WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('DeleteFeedback error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
