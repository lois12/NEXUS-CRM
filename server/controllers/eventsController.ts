import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';

export const getEvents = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const events = query('SELECT * FROM events ORDER BY date DESC LIMIT ?', [limit]);
    res.json({ success: true, data: events });
  } catch (error) {
    console.error('GetEvents error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createEvent = (req: AuthRequest, res: Response) => {
  try {
    const { title, description, date, location, status, responsiblePerson, budget, imageUrl } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const id = uuidv4();
    run('INSERT INTO events (id, title, description, date, location, status, responsiblePerson, budget, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, description || '', date || null, location || '', status || 'planned', responsiblePerson || '', budget || 0, imageUrl || '']);

    const event = get('SELECT * FROM events WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error('CreateEvent error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateEvent = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, date, location, status, responsiblePerson, budget, imageUrl } = req.body;

    const event = get('SELECT * FROM events WHERE id = ?', [id]);
    if (!event) return res.status(404).json({ success: false, error: 'Мероприятие не найдено' });

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (date !== undefined) { updates.push('date = ?'); params.push(date); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (responsiblePerson !== undefined) { updates.push('responsiblePerson = ?'); params.push(responsiblePerson); }
    if (budget !== undefined) { updates.push('budget = ?'); params.push(budget); }
    if (imageUrl !== undefined) { updates.push('imageUrl = ?'); params.push(imageUrl); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Мероприятие обновлено' });
  } catch (error) {
    console.error('UpdateEvent error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteEvent = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const event = get('SELECT id, imageUrl FROM events WHERE id = ?', [id]);
    if (!event) return res.status(404).json({ success: false, error: 'Мероприятие не найдено' });
    if (event.imageUrl) {
      const filePath = path.join(UPLOADS_DIR, path.basename(event.imageUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    run('DELETE FROM events WHERE id = ?', [id]);
    res.json({ success: true, message: 'Мероприятие удалено' });
  } catch (error) {
    console.error('DeleteEvent error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
