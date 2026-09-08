import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

export const getAllIdeas = (req: AuthRequest, res: Response) => {
  try {
    const ideas = query(`
      SELECT i.*, u.fullName as authorName
      FROM ideas i
      LEFT JOIN users u ON i.authorId = u.id
      ORDER BY i.createdAt DESC
    `);

    const links = query('SELECT * FROM idea_links');

    res.json({ success: true, data: { ideas, links } });
  } catch (error) {
    console.error('GetAllIdeas error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createIdea = (req: AuthRequest, res: Response) => {
  try {
    const { title, content, type, color, parentId } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Заголовок обязателен' });
    }

    const id = uuidv4();
    const authorId = req.user?.id;

    const typeColors: Record<string, string> = {
      task: '#00ff88',
      idea: '#00d4ff',
      problem: '#ff3b30',
      goal: '#bf00ff',
      note: '#eab308',
      default: '#6b7280',
    };

    const finalColor = color || typeColors[type || 'default'] || '#6b7280';

    run(`
      INSERT INTO ideas (id, title, content, type, color, parentId, authorId)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, title, content || '', type || 'default', finalColor, parentId || null, authorId]);

    // Auto-link to parent
    if (parentId) {
      run(`
        INSERT INTO idea_links (id, sourceId, targetId)
        VALUES (?, ?, ?)
      `, [uuidv4(), parentId, id]);
    }

    const idea = get('SELECT * FROM ideas WHERE id = ?', [id]);

    res.status(201).json({ success: true, data: idea });
  } catch (error) {
    console.error('CreateIdea error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateIdea = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, type, color, parentId } = req.body;

    const idea = get('SELECT * FROM ideas WHERE id = ?', [id]);
    if (!idea) {
      return res.status(404).json({ success: false, error: 'Идея не найдена' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }
    if (parentId !== undefined) { updates.push('parentId = ?'); params.push(parentId || null); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE ideas SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Идея обновлена' });
  } catch (error) {
    console.error('UpdateIdea error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteIdea = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const idea = get('SELECT * FROM ideas WHERE id = ?', [id]);
    if (!idea) {
      return res.status(404).json({ success: false, error: 'Идея не найдена' });
    }

    // Delete links
    run('DELETE FROM idea_links WHERE sourceId = ? OR targetId = ?', [id, id]);
    // Detach children
    run('UPDATE ideas SET parentId = NULL WHERE parentId = ?', [id]);
    // Delete idea
    run('DELETE FROM ideas WHERE id = ?', [id]);

    res.json({ success: true, message: 'Идея удалена' });
  } catch (error) {
    console.error('DeleteIdea error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createLink = (req: AuthRequest, res: Response) => {
  try {
    const { sourceId, targetId, label } = req.body;

    if (!sourceId || !targetId) {
      return res.status(400).json({ success: false, error: 'sourceId и targetId обязательны' });
    }

    // Check if link already exists
    const existing = get(
      'SELECT id FROM idea_links WHERE (sourceId = ? AND targetId = ?) OR (sourceId = ? AND targetId = ?)',
      [sourceId, targetId, targetId, sourceId]
    );

    if (existing) {
      return res.status(400).json({ success: false, error: 'Связь уже существует' });
    }

    const id = uuidv4();
    run(`
      INSERT INTO idea_links (id, sourceId, targetId, label)
      VALUES (?, ?, ?, ?)
    `, [id, sourceId, targetId, label || null]);

    res.status(201).json({ success: true, data: { id, sourceId, targetId, label } });
  } catch (error) {
    console.error('CreateLink error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteLink = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    run('DELETE FROM idea_links WHERE id = ?', [id]);

    res.json({ success: true, message: 'Связь удалена' });
  } catch (error) {
    console.error('DeleteLink error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// Comments
export const getComments = (req: AuthRequest, res: Response) => {
  try {
    const { ideaId } = req.params;
    const comments = query(`
      SELECT c.*, u.fullName as authorName, u.avatar as authorAvatar
      FROM idea_comments c
      LEFT JOIN users u ON c.authorId = u.id
      WHERE c.ideaId = ?
      ORDER BY c.createdAt ASC
    `, [ideaId]);
    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('GetComments error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const addComment = (req: AuthRequest, res: Response) => {
  try {
    const { ideaId } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, error: 'Текст обязателен' });

    const id = uuidv4();
    run('INSERT INTO idea_comments (id, ideaId, content, authorId) VALUES (?, ?, ?, ?)', [id, ideaId, content, req.user?.id]);
    const comment = get('SELECT c.*, u.fullName as authorName FROM idea_comments c LEFT JOIN users u ON c.authorId = u.id WHERE c.id = ?', [id]);
    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error('AddComment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteComment = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const comment = get('SELECT * FROM idea_comments WHERE id = ?', [id]);
    if (!comment) return res.status(404).json({ success: false, error: 'Комментарий не найден' });
    if (comment.authorId !== req.user!.id && !(req.user!.roles || [req.user!.role]).includes('super_admin')) {
      return res.status(403).json({ success: false, error: 'Нельзя удалить чужой комментарий' });
    }
    run('DELETE FROM idea_comments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Комментарий удалён' });
  } catch (error) {
    console.error('DeleteComment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// Attachments
export const getAttachments = (req: AuthRequest, res: Response) => {
  try {
    const { ideaId } = req.params;
    const attachments = query('SELECT * FROM idea_attachments WHERE ideaId = ? ORDER BY createdAt DESC', [ideaId]);
    res.json({ success: true, data: attachments });
  } catch (error) {
    console.error('GetAttachments error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadAttachment = (req: AuthRequest, res: Response) => {
  try {
    const { ideaId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const id = uuidv4();
    const url = `/uploads/${file.filename}`;
    const decodedName = (file as any).decodedOriginalname || file.originalname;
    run('INSERT INTO idea_attachments (id, ideaId, filename, url, mimeType, size, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, ideaId, decodedName, url, file.mimetype, file.size, req.user?.id]);
    res.status(201).json({ success: true, data: { id, ideaId, filename: decodedName, url, mimeType: file.mimetype, size: file.size } });
  } catch (error) {
    console.error('UploadAttachment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteAttachment = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const att = get('SELECT * FROM idea_attachments WHERE id = ?', [id]);
    if (!att) return res.status(404).json({ success: false, error: 'Вложение не найдено' });
    if (att.uploadedBy !== req.user!.id && !(req.user!.roles || [req.user!.role]).includes('super_admin')) {
      return res.status(403).json({ success: false, error: 'Нельзя удалить чужое вложение' });
    }
    run('DELETE FROM idea_attachments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Вложение удалено' });
  } catch (error) {
    console.error('DeleteAttachment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
