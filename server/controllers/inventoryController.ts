import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

export const getInventory = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const items = query('SELECT * FROM inventory ORDER BY createdAt DESC LIMIT ?', [limit]);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('GetInventory error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createItem = (req: AuthRequest, res: Response) => {
  try {
    const { name, type, description, quantity, unit, location, responsiblePerson, serialNumber, purchaseDate, purchasePrice, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const id = uuidv4();
    run(`INSERT INTO inventory (id, name, type, description, quantity, unit, location, responsiblePerson, serialNumber, purchaseDate, purchasePrice, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, type || 'ТМЦ', description || '', quantity ?? 1, unit || 'шт', location || '', responsiblePerson || '', serialNumber || '', purchaseDate || null, purchasePrice || 0, status || 'active']);

    const item = get('SELECT * FROM inventory WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('CreateItem error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateItem = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, description, quantity, unit, location, responsiblePerson, serialNumber, purchaseDate, purchasePrice, status } = req.body;

    const item = get('SELECT * FROM inventory WHERE id = ?', [id]);
    if (!item) return res.status(404).json({ success: false, error: 'Запись не найдена' });

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (quantity !== undefined) { updates.push('quantity = ?'); params.push(quantity); }
    if (unit !== undefined) { updates.push('unit = ?'); params.push(unit); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (responsiblePerson !== undefined) { updates.push('responsiblePerson = ?'); params.push(responsiblePerson); }
    if (serialNumber !== undefined) { updates.push('serialNumber = ?'); params.push(serialNumber); }
    if (purchaseDate !== undefined) { updates.push('purchaseDate = ?'); params.push(purchaseDate); }
    if (purchasePrice !== undefined) { updates.push('purchasePrice = ?'); params.push(purchasePrice); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE inventory SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Запись обновлена' });
  } catch (error) {
    console.error('UpdateItem error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteItem = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    run('DELETE FROM inventory WHERE id = ?', [id]);
    res.json({ success: true, message: 'Запись удалена' });
  } catch (error) {
    console.error('DeleteItem error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
