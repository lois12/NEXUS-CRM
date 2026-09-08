import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, run, get } from '../db/database';
import { AuthRequest } from '../middleware/auth';

export function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  relatedId?: string;
  senderId?: string;
}) {
  run(
    `INSERT INTO notifications (id, userId, type, title, body, link, relatedId, senderId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), data.userId, data.type, data.title, data.body || '', data.link || '', data.relatedId || null, data.senderId || null]
  );
}

export function createNotificationsBatch(items: Array<{
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  relatedId?: string;
  senderId?: string;
}>) {
  if (items.length === 0) return;
  const values: any[] = [];
  const placeholders: string[] = [];
  for (const item of items) {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
    values.push(uuidv4(), item.userId, item.type, item.title, item.body || '', item.link || '', item.relatedId || null, item.senderId || null);
  }
  run(`INSERT INTO notifications (id, userId, type, title, body, link, relatedId, senderId) VALUES ${placeholders.join(', ')}`, values);
}

export const getNotifications = (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unread === '1';
    let sql = `SELECT n.*, u.fullName as senderName, u.avatar as senderAvatar
               FROM notifications n
               LEFT JOIN users u ON n.senderId = u.id
               WHERE n.userId = ?`;
    const params: any[] = [req.user!.id];
    if (unreadOnly) { sql += ' AND n.isRead = 0'; }
    sql += ' ORDER BY n.createdAt DESC LIMIT ?';
    params.push(limit);
    const notifications = query(sql, params);
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('GetNotifications error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getUnreadCount = (req: AuthRequest, res: Response) => {
  try {
    const result = get('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0', [req.user!.id]);
    res.json({ success: true, data: { count: result?.count || 0 } });
  } catch (error) {
    console.error('GetUnreadCount error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const markAsRead = (req: AuthRequest, res: Response) => {
  try {
    run('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('MarkAsRead error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const markAllAsRead = (req: AuthRequest, res: Response) => {
  try {
    run('UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0', [req.user!.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('MarkAllAsRead error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
