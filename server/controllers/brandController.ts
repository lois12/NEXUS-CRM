import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';

export const getAssets = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const assets = query(`
      SELECT ba.*, u.fullName as uploaderName
      FROM brand_assets ba
      LEFT JOIN users u ON ba.uploadedBy = u.id
      ORDER BY ba.createdAt DESC LIMIT ?
    `, [limit]);
    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('GetAssets error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createAsset = (req: AuthRequest, res: Response) => {
  try {
    const { name, category, description, url, mimeType, size } = req.body;
    if (!name || !url) return res.status(400).json({ success: false, error: 'Название и файл обязательны' });

    const id = uuidv4();
    run('INSERT INTO brand_assets (id, name, category, description, url, mimeType, size, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, category || 'logo', description || '', url, mimeType || '', size || 0, req.user?.id]);

    const asset = get('SELECT * FROM brand_assets WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    console.error('CreateAsset error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateAsset = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, description } = req.body;

    const asset = get('SELECT * FROM brand_assets WHERE id = ?', [id]);
    if (!asset) return res.status(404).json({ success: false, error: 'Файл не найден' });

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE brand_assets SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Обновлено' });
  } catch (error) {
    console.error('UpdateAsset error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteAsset = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const asset = get('SELECT url FROM brand_assets WHERE id = ?', [id]);
    if (asset?.url) {
      const filePath = path.join(UPLOADS_DIR, path.basename(asset.url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    run('DELETE FROM brand_assets WHERE id = ?', [id]);
    res.json({ success: true, message: 'Удалено' });
  } catch (error) {
    console.error('DeleteAsset error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
