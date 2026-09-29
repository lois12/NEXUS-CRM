import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
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
      ORDER BY w.isPinned DESC, w.createdAt DESC
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
    const { title, description, category } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const id = uuidv4();
    run(`INSERT INTO widgets (id, title, description, category, createdBy) VALUES (?, ?, ?, ?, ?)`,
      [id, title, description || '', category || '', req.user?.id]);

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

    const { title, description, htmlCode, imageUrl, category } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (htmlCode !== undefined) { updates.push('htmlCode = ?'); params.push(htmlCode); }
    if (imageUrl !== undefined) { updates.push('imageUrl = ?'); params.push(imageUrl); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }

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

    if (widget.imageUrl) {
      const oldPath = path.join(UPLOADS_DIR, path.basename(widget.imageUrl));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const imageUrl = `/uploads/${req.file.filename}`;
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
      run("UPDATE widgets SET isPublic = 0, publicSlug = NULL, updatedAt = datetime('now') WHERE id = ?", [id]);
    } else {
      // Use customSlug if set, otherwise generate random
      const slug = (widget.customSlug && widget.customSlug.trim()) ? widget.customSlug.trim() : uuidv4().slice(0, 8);
      run("UPDATE widgets SET isPublic = 1, publicSlug = ?, updatedAt = datetime('now') WHERE id = ?", [slug, id]);
    }

    const updated = get('SELECT * FROM widgets WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('TogglePublish error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// Toggle pin
export const togglePin = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const widget = get('SELECT * FROM widgets WHERE id = ?', [id]);
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });

    run("UPDATE widgets SET isPinned = ?, updatedAt = datetime('now') WHERE id = ?", [widget.isPinned ? 0 : 1, id]);
    const updated = get('SELECT * FROM widgets WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('TogglePin error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// Duplicate widget
export const duplicateWidget = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const widget = get('SELECT * FROM widgets WHERE id = ?', [id]);
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });

    const newId = uuidv4();
    run(`INSERT INTO widgets (id, title, description, imageUrl, htmlCode, category, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId, widget.title + ' (копия)', widget.description, '', widget.htmlCode, widget.category, req.user?.id]);

    const newWidget = get('SELECT * FROM widgets WHERE id = ?', [newId]);
    res.status(201).json({ success: true, data: newWidget });
  } catch (error) {
    console.error('DuplicateWidget error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// Update custom slug + password
export const updatePublishSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const widget = get('SELECT * FROM widgets WHERE id = ?', [id]);
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });

    const { customSlug, password } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (customSlug !== undefined) {
      // Check uniqueness
      const slug = customSlug.trim();
      if (slug) {
        const existing = get('SELECT id FROM widgets WHERE customSlug = ? AND id != ?', [slug, id]);
        if (existing) return res.status(400).json({ success: false, error: 'Этот slug уже занят' });
      }
      updates.push('customSlug = ?');
      params.push(slug);
      // If currently published, update publicSlug too
      if (widget.isPublic && slug) {
        updates.push('publicSlug = ?');
        params.push(slug);
      }
    }
    if (password !== undefined) {
      const hashed = password && password.trim() ? await bcrypt.hash(password, 10) : '';
      updates.push('password = ?');
      params.push(hashed);
    }

    if (updates.length === 0) return res.json({ success: true, data: widget });

    updates.push("updatedAt = datetime('now')");
    params.push(id);
    run(`UPDATE widgets SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = get('SELECT * FROM widgets WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('UpdatePublishSettings error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Public (no auth) ──

export const getPublicWidget = async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const widget = get(
      'SELECT title, description, imageUrl, htmlCode, publicSlug, password, viewCount FROM widgets WHERE publicSlug = ? AND isPublic = 1',
      [slug]
    );
    if (!widget) return res.status(404).json({ success: false, error: 'Виджет не найден' });

    // If password set, require it
    if (widget.password && widget.password.trim()) {
      const providedPass = req.query.pass as string || req.headers['x-widget-password'] as string || '';
      const isValid = await bcrypt.compare(providedPass, widget.password);
      if (!isValid) {
        return res.json({ success: true, data: { title: widget.title, description: widget.description, imageUrl: widget.imageUrl, publicSlug: widget.publicSlug, requiresPassword: true } });
      }
    }

    // Increment view count
    run('UPDATE widgets SET viewCount = viewCount + 1 WHERE publicSlug = ?', [slug]);

    res.json({ success: true, data: { title: widget.title, description: widget.description, imageUrl: widget.imageUrl, htmlCode: widget.htmlCode, publicSlug: widget.publicSlug } });
  } catch (error) {
    console.error('GetPublicWidget error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};