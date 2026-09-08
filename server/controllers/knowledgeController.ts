import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

export const getArticles = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const articles = query(`
      SELECT kb.*, u.fullName as authorName
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
    const article = get('SELECT id FROM knowledge_base WHERE id = ?', [id]);
    if (!article) return res.status(404).json({ success: false, error: 'Статья не найдена' });
    run('DELETE FROM knowledge_base WHERE id = ?', [id]);
    res.json({ success: true, message: 'Статья удалена' });
  } catch (error) {
    console.error('DeleteArticle error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
