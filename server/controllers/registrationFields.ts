import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

export const createField = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT id FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const { type, label, placeholder, required, options, settings, position } = req.body;
    if (!type || !label) return res.status(400).json({ success: false, error: 'Тип и название обязательны' });

    const fieldId = uuidv4();
    const maxPos = get('SELECT MAX(position) as maxPos FROM registration_fields WHERE registrationId = ?', [id]);
    const pos = position ?? ((maxPos?.maxPos ?? -1) + 1);

    const optStr = typeof options === 'string' ? options : JSON.stringify(options || []);
    const setStr = typeof settings === 'string' ? settings : JSON.stringify(settings || {});
    run('INSERT INTO registration_fields (id, registrationId, type, label, placeholder, required, options, settings, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [fieldId, id, type, label, placeholder || '', required ? 1 : 0, optStr, setStr, pos]);

    const field = get('SELECT * FROM registration_fields WHERE id = ?', [fieldId]);
    res.status(201).json({ success: true, data: field });
  } catch (error) {
    console.error('CreateField error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateField = (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.params;
    const field = get('SELECT * FROM registration_fields WHERE id = ?', [fieldId]);
    if (!field) return res.status(404).json({ success: false, error: 'Поле не найдено' });

    const { type, label, placeholder, required, options, settings, position } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (label !== undefined) { updates.push('label = ?'); params.push(label); }
    if (placeholder !== undefined) { updates.push('placeholder = ?'); params.push(placeholder); }
    if (required !== undefined) { updates.push('required = ?'); params.push(required ? 1 : 0); }
    if (options !== undefined) { updates.push('options = ?'); params.push(typeof options === 'string' ? options : JSON.stringify(options)); }
    if (settings !== undefined) { updates.push('settings = ?'); params.push(typeof settings === 'string' ? settings : JSON.stringify(settings)); }
    if (position !== undefined) { updates.push('position = ?'); params.push(position); }

    params.push(fieldId);

    if (updates.length > 0) {
      run(`UPDATE registration_fields SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Поле обновлено' });
  } catch (error) {
    console.error('UpdateField error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteField = (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.params;
    const field = get('SELECT id FROM registration_fields WHERE id = ?', [fieldId]);
    if (!field) return res.status(404).json({ success: false, error: 'Поле не найдено' });
    run('DELETE FROM registration_fields WHERE id = ?', [fieldId]);
    res.json({ success: true, message: 'Поле удалено' });
  } catch (error) {
    console.error('DeleteField error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const reorderFields = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { order } = req.body; // string[] of field IDs
    if (!Array.isArray(order)) return res.status(400).json({ success: false, error: 'order массив обязателен' });

    order.forEach((fieldId: string, index: number) => {
      run('UPDATE registration_fields SET position = ? WHERE id = ? AND registrationId = ?', [index, fieldId, id]);
    });

    res.json({ success: true, message: 'Порядок обновлён' });
  } catch (error) {
    console.error('ReorderFields error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};