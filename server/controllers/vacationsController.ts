import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

export const getVacations = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const vacations = query(`
      SELECT v.*, u.fullName as userName, u.role as userRole,
             a.fullName as approverName
      FROM vacations v
      LEFT JOIN users u ON v.userId = u.id
      LEFT JOIN users a ON v.approvedBy = a.id
      ORDER BY v.createdAt DESC LIMIT ?
    `, [limit]);
    res.json({ success: true, data: vacations });
  } catch (error) {
    console.error('GetVacations error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createVacation = (req: AuthRequest, res: Response) => {
  try {
    const { userId, startDate, endDate, type, notes } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ success: false, error: 'Даты обязательны' });

    const id = uuidv4();
    const uid = userId || req.user?.id;

    run('INSERT INTO vacations (id, userId, startDate, endDate, type, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [id, uid, startDate, endDate, type || 'annual', notes || '']);

    const vacation = get('SELECT v.*, u.fullName as userName FROM vacations v LEFT JOIN users u ON v.userId = u.id WHERE v.id = ?', [id]);
    res.status(201).json({ success: true, data: vacation });
  } catch (error) {
    console.error('CreateVacation error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateVacation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, approvedBy } = req.body;

    const vacation = get('SELECT * FROM vacations WHERE id = ?', [id]);
    if (!vacation) return res.status(404).json({ success: false, error: 'Заявка не найдена' });

    const updates: string[] = [];
    const params: any[] = [];

    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (approvedBy !== undefined) { updates.push('approvedBy = ?'); params.push(approvedBy); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE vacations SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Заявка обновлена' });
  } catch (error) {
    console.error('UpdateVacation error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteVacation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const vacation = get('SELECT id FROM vacations WHERE id = ?', [id]);
    if (!vacation) return res.status(404).json({ success: false, error: 'Заявка не найдена' });
    run('DELETE FROM vacations WHERE id = ?', [id]);
    res.json({ success: true, message: 'Заявка удалена' });
  } catch (error) {
    console.error('DeleteVacation error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
