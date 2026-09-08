import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

export const getPartners = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const partners = query('SELECT * FROM partners ORDER BY createdAt DESC LIMIT ?', [limit]);
    res.json({ success: true, data: partners });
  } catch (error) {
    console.error('GetPartners error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createPartner = (req: AuthRequest, res: Response) => {
  try {
    const { name, type, category, contactPerson, email, phone, address, inn, notes, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const id = uuidv4();
    run('INSERT INTO partners (id, name, type, category, contactPerson, email, phone, address, inn, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, type || 'partner', category || '', contactPerson || '', email || '', phone || '', address || '', inn || '', notes || '', status || 'active']);

    const partner = get('SELECT * FROM partners WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: partner });
  } catch (error) {
    console.error('CreatePartner error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updatePartner = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, category, contactPerson, email, phone, address, inn, notes, status } = req.body;

    const partner = get('SELECT * FROM partners WHERE id = ?', [id]);
    if (!partner) return res.status(404).json({ success: false, error: 'Партнёр не найден' });

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (contactPerson !== undefined) { updates.push('contactPerson = ?'); params.push(contactPerson); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (inn !== undefined) { updates.push('inn = ?'); params.push(inn); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE partners SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Партнёр обновлён' });
  } catch (error) {
    console.error('UpdatePartner error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deletePartner = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const partner = get('SELECT * FROM partners WHERE id = ?', [id]);
    if (!partner) return res.status(404).json({ success: false, error: 'Партнёр не найден' });

    run('DELETE FROM partners WHERE id = ?', [id]);
    res.json({ success: true, message: 'Партнёр удалён' });
  } catch (error) {
    console.error('DeletePartner error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
