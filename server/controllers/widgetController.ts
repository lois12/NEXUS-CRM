import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';

// ── Authenticated CRUD ──

export const getWidgets = (req: AuthRequest, res: Response) => {
  try {
    const widgets = query(`
      SELECT w.*, u.fullName as creatorName
      FROM widgets w
      LEFT JOIN users u ON w.createdBy = u.id
      ORDER BY w.createdAt DESC
    `);
    res.json({ success: true, data: widgets });
  } catch (error) {
    console.error('GetWidgets error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getWidgetById = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const widget = get(`
      SELECT w.*, u.fullName as creatorName
      FROM widgets w
      LEFT JOIN users u ON w.createdBy = u.id
      WHERE w.id = ?
    `, [id]);
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });
    res.json({ success: true, data: widget });
  } catch (error) {
    console.error('GetWidgetById error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createWidget = (req: AuthRequest, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const id = uuidv4();
    run(`INSERT INTO widgets (id, title, description, createdBy) VALUES (?, ?, ?, ?)`,
      [id, title, description || '', req.user?.id]);

    const widget = get('SELECT * FROM widgets WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: widget });
  } catch (error) {
    console.error('CreateWidget error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateWidget = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const widget = get('SELECT * FROM widgets WHERE id = ?', [id]);
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });

    const { title, description, htmlCode, imageUrl, isPublic } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (htmlCode !== undefined) { updates.push('htmlCode = ?'); params.push(htmlCode); }
    if (imageUrl !== undefined) { updates.push('imageUrl = ?'); params.push(imageUrl); }
    if (isPublic !== undefined) { updates.push('isPublic = ?'); params.push(isPublic ? 1 : 0); }

    if (updates.length === 0) return res.json({ success: true, data: widget });

    updates.push("updatedAt = datetime('now')");
    params.push(id);
    run(`UPDATE widgets SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = get('SELECT * FROM widgets WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('UpdateWidget error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteWidget = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const widget = get('SELECT * FROM widgets WHERE id = ?', [id]);
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });

    // Delete image file if exists
    if (widget.imageUrl) {
      const imgPath = path.join(UPLOADS_DIR, path.basename(widget.imageUrl));
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    run('DELETE FROM widgets WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('DeleteWidget error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadImage = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const widget = get('SELECT * FROM widgets WHERE id = ?', [id]);
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });
    if (!req.file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    // Delete old image
    if (widget.imageUrl) {
      const oldPath = path.join(UPLOADS_DIR, path.basename(widget.imageUrl));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const ext = path.extname(req.file.originalname);
    const filename = `widget_${id}${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    const imageUrl = `/uploads/${filename}`;
    run("UPDATE widgets SET imageUrl = ?, updatedAt = datetime('now') WHERE id = ?", [imageUrl, id]);

    res.json({ success: true, data: { imageUrl } });
  } catch (error) {
    console.error('UploadWidgetImage error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const togglePublish = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const widget = get('SELECT * FROM widgets WHERE id = ?', [id]);
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });

    if (widget.isPublic) {
      // Unpublish
      run("UPDATE widgets SET isPublic = 0, publicSlug = NULL, updatedAt = datetime('now') WHERE id = ?", [id]);
    } else {
      // Publish — generate slug
      const slug = uuidv4().slice(0, 8);
      run("UPDATE widgets SET isPublic = 1, publicSlug = ?, updatedAt = datetime('now') WHERE id = ?", [slug, id]);
    }

    const updated = get('SELECT * FROM widgets WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('TogglePublish error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Public (no auth) ──

export const getPublicWidget = (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const widget = get(
      'SELECT title, description, imageUrl, htmlCode, publicSlug FROM widgets WHERE publicSlug = ? AND isPublic = 1',
      [slug]
    );
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });
    res.json({ success: true, data: widget });
  } catch (error) {
    console.error('GetPublicWidget error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};