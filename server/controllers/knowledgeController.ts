import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';

// ── Articles ──

export const getArticles = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const articles = query(`
      SELECT kb.*, u.fullName as authorName,
        (SELECT COUNT(*) FROM knowledge_attachments ka WHERE ka.articleId = kb.id) as attachmentCount
      FROM knowledge_base kb
      LEFT JOIN users u ON kb.authorId = u.id
      ORDER BY kb.createdAt DESC LIMIT ?
    `, [limit]);
    res.json({ success: true, data: articles });
  } catch (error) {
    console.error('GetArticles error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createArticle = (req: AuthRequest, res: Response) => {
  try {
    const { title, content, category, tags } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Заголовок обязателен' });

    const id = uuidv4();
    run('INSERT INTO knowledge_base (id, title, content, category, tags, authorId) VALUES (?, ?, ?, ?, ?, ?)',
      [id, title, content || '', category || '', tags || '', req.user?.id]);

    const article = get('SELECT * FROM knowledge_base WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: article });
  } catch (error) {
    console.error('CreateArticle error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateArticle = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, category, tags } = req.body;

    const article = get('SELECT * FROM knowledge_base WHERE id = ?', [id]);
    if (!article) return res.status(404).json({ success: false, error: 'Статья не найдена' });

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (tags !== undefined) { updates.push('tags = ?'); params.push(tags); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE knowledge_base SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Статья обновлена' });
  } catch (error) {
    console.error('UpdateArticle error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteArticle = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const article = get('SELECT id, authorId FROM knowledge_base WHERE id = ?', [id]);
    if (!article) return res.status(404).json({ success: false, error: 'Статья не найдена' });

    // Only author or super_admin can delete
    const userId = req.user?.id;
    const userRoles = req.user?.roles || [req.user?.role || ''];
    const isSuperAdmin = userRoles.some((r: string) => ['super_admin'].includes(r));
    if (article.authorId !== userId && !isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Только автор или администратор может удалить статью' });
    }

    // Delete attachment files from disk
    const attachments = query('SELECT url FROM knowledge_attachments WHERE articleId = ?', [id]);
    for (const att of attachments) {
      const filePath = path.join(UPLOADS_DIR, path.basename(att.url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    run('DELETE FROM knowledge_base WHERE id = ?', [id]);
    res.json({ success: true, message: 'Статья удалена' });
  } catch (error) {
    console.error('DeleteArticle error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Attachments ──

export const getAttachments = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const attachments = query(`
      SELECT ka.*, u.fullName as uploaderName
      FROM knowledge_attachments ka
      LEFT JOIN users u ON ka.uploadedBy = u.id
      WHERE ka.articleId = ?
      ORDER BY ka.position ASC, ka.createdAt ASC
    `, [id]);
    res.json({ success: true, data: attachments });
  } catch (error) {
    console.error('GetAttachments error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadAttachment = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const article = get('SELECT id FROM knowledge_base WHERE id = ?', [id]);
    if (!article) return res.status(404).json({ success: false, error: 'Статья не найдена' });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const isImage = file.mimetype.startsWith('image/');
    const type = isImage ? 'image' : 'document';
    const originalName = (file as any).decodedOriginalname || file.originalname;

    const attId = uuidv4();
    const maxPos = get('SELECT MAX(position) as maxPos FROM knowledge_attachments WHERE articleId = ?', [id]);
    const pos = (maxPos?.maxPos ?? -1) + 1;

    run('INSERT INTO knowledge_attachments (id, articleId, type, url, filename, originalName, size, uploadedBy, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [attId, id, type, `/uploads/${file.filename}`, file.filename, originalName, file.size, req.user?.id, pos]);

    const attachment = get('SELECT * FROM knowledge_attachments WHERE id = ?', [attId]);
    res.status(201).json({ success: true, data: attachment });
  } catch (error) {
    console.error('UploadAttachment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteAttachment = (req: AuthRequest, res: Response) => {
  try {
    const { attId } = req.params;
    const attachment = get('SELECT * FROM knowledge_attachments WHERE id = ?', [attId]);
    if (!attachment) return res.status(404).json({ success: false, error: 'Файл не найден' });

    // Only uploader or article author or super_admin can delete
    const userId = req.user?.id;
    const userRoles = req.user?.roles || [req.user?.role || ''];
    const isSuperAdmin = userRoles.some((r: string) => ['super_admin'].includes(r));
    const article = get('SELECT authorId FROM knowledge_base WHERE id = ?', [attachment.articleId]);

    if (attachment.uploadedBy !== userId && article?.authorId !== userId && !isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Нет прав на удаление этого файла' });
    }

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, path.basename(attachment.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    run('DELETE FROM knowledge_attachments WHERE id = ?', [attId]);
    res.json({ success: true, message: 'Файл удалён' });
  } catch (error) {
    console.error('DeleteAttachment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
