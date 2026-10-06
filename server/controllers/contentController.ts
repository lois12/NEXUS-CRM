import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './notificationController';

/** platforms JSON-array with legacy fallback to single `platform` column */
function parsePlatforms(row: any): string[] {
  if (row?.platforms) {
    try {
      const arr = JSON.parse(row.platforms);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch { /* fall through */ }
  }
  return row?.platform ? [row.platform] : ['telegram'];
}

function normalizePlatforms(input: unknown, fallback?: string): string[] {
  let arr: string[] = [];
  if (Array.isArray(input)) arr = input.filter((p) => typeof p === 'string' && p);
  else if (typeof input === 'string' && input) arr = [input];
  if (arr.length === 0 && fallback) arr = [fallback];
  if (arr.length === 0) arr = ['telegram'];
  return [...new Set(arr)];
}

function shapePost(row: any) {
  const platforms = parsePlatforms(row);
  return { ...row, platforms, platform: row.platform || platforms[0] };
}

// ─── Posts CRUD ────────────────────────────────────────────────

export const getAllPosts = (req: AuthRequest, res: Response) => {
  try {
    const { platform, status } = req.query;

    let sql = `
      SELECT cp.*, u.fullName as authorName, u.avatar as authorAvatar
      FROM content_posts cp
      LEFT JOIN users u ON cp.authorId = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (platform && platform !== 'all') {
      // match legacy `platform` OR any tag inside `platforms` JSON array
      sql += ' AND (cp.platform = ? OR cp.platforms LIKE ?)';
      params.push(platform, `%"${platform}"%`);
    }

    if (status && status !== 'all') {
      sql += ' AND cp.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY cp.createdAt DESC';
    const posts = query(sql, params).map(shapePost);
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('GetAllPosts error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getPostById = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const post = get(`
      SELECT cp.*, u.fullName as authorName, u.avatar as authorAvatar
      FROM content_posts cp LEFT JOIN users u ON cp.authorId = u.id
      WHERE cp.id = ?
    `, [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
    res.json({ success: true, data: shapePost(post) });
  } catch (error) {
    console.error('GetPostById error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createPost = (req: AuthRequest, res: Response) => {
  try {
    const { title, content, platform, platforms, status, scheduledDate, imageUrl } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: 'Заголовок и содержание обязательны' });

    const id = uuidv4();
    const authorId = req.user!.id;
    const list = normalizePlatforms(platforms, platform);
    const primary = list[0];

    run(`INSERT INTO content_posts (id, title, content, platform, platforms, status, scheduledDate, imageUrl, authorId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, content, primary, JSON.stringify(list), status || 'черновик', scheduledDate || null, imageUrl || null, authorId]);

    run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'post_created', `Создан пост: ${title}`, authorId]);

    res.status(201).json({ success: true, data: { id, title, content, platform: primary, platforms: list, status, scheduledDate, imageUrl, authorId } });
  } catch (error) {
    console.error('CreatePost error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updatePost = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, platform, platforms, status, scheduledDate, imageUrl } = req.body;
    const post = get('SELECT * FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (platforms !== undefined || platform !== undefined) {
      const list = normalizePlatforms(
        platforms !== undefined ? platforms : platform,
        parsePlatforms(post)[0]
      );
      updates.push('platforms = ?'); params.push(JSON.stringify(list));
      updates.push('platform = ?'); params.push(list[0]);
    }
    if (status) {
      updates.push('status = ?'); params.push(status);
      if (status === 'опубликован') updates.push("publishedDate = datetime('now')");
    }
    if (scheduledDate !== undefined) { updates.push('scheduledDate = ?'); params.push(scheduledDate || null); }
    if (imageUrl !== undefined) { updates.push('imageUrl = ?'); params.push(imageUrl || null); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) run(`UPDATE content_posts SET ${updates.join(', ')} WHERE id = ?`, params);

    if (status === 'опубликован' && post.status !== 'опубликован') {
      run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
        [uuidv4(), 'post_published', `Опубликован пост: ${title || post.title}`, req.user!.id]);
    }

    res.json({ success: true, message: 'Пост обновлен' });
  } catch (error) {
    console.error('UpdatePost error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deletePost = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const post = get('SELECT * FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });

    run('DELETE FROM content_comments WHERE postId = ?', [id]);
    run('DELETE FROM content_approvals WHERE postId = ?', [id]);
    run('DELETE FROM content_posts WHERE id = ?', [id]);

    run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'post_deleted', `Удален пост: ${post.title}`, req.user!.id]);

    res.json({ success: true, message: 'Пост удален' });
  } catch (error) {
    console.error('DeletePost error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ─── Publish ───────────────────────────────────────────────────

export const publishPost = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const post = get('SELECT * FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
    if (post.status === 'опубликован') return res.status(400).json({ success: false, error: 'Пост уже опубликован' });

    run("UPDATE content_posts SET status = 'опубликован', publishedDate = datetime('now'), updatedAt = datetime('now') WHERE id = ?", [id]);

    run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'post_published', `Опубликован пост: ${post.title}`, req.user!.id]);

    // Notify via socket
    const io = req.app.get('io');
    if (io) io.emit('content:status', { postId: id, status: 'опубликован', title: post.title });

    res.json({ success: true, message: 'Пост опубликован' });
  } catch (error) {
    console.error('PublishPost error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ─── Comments ──────────────────────────────────────────────────

export const getComments = (req: AuthRequest, res: Response) => {
  try {
    const { id: postId } = req.params;
    const comments = query(`
      SELECT c.*, u.fullName as authorName, u.avatar as authorAvatar
      FROM content_comments c LEFT JOIN users u ON c.authorId = u.id
      WHERE c.postId = ? ORDER BY c.createdAt ASC
    `, [postId]);
    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('GetComments error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const addComment = (req: AuthRequest, res: Response) => {
  try {
    const { id: postId } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, error: 'Комментарий не может быть пустым' });

    const commentId = uuidv4();
    run('INSERT INTO content_comments (id, postId, content, authorId) VALUES (?, ?, ?, ?)', [commentId, postId, content, req.user!.id]);

    // Notify post author (if not self)
    const post = get('SELECT authorId, title FROM content_posts WHERE id = ?', [postId]);
    if (post && post.authorId !== req.user!.id) {
      createNotification({
        userId: post.authorId,
        type: 'content_comment',
        title: 'Новый комментарий к посту',
        body: `${req.user!.username} прокомментировал "${post.title}": ${content.substring(0, 80)}`,
        link: '/content',
        relatedId: postId,
        senderId: req.user!.id,
      });
    }

    const comment = get(`SELECT c.*, u.fullName as authorName, u.avatar as authorAvatar FROM content_comments c LEFT JOIN users u ON c.authorId = u.id WHERE c.id = ?`, [commentId]);
    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error('AddComment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteComment = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const comment = get('SELECT * FROM content_comments WHERE id = ?', [id]);
    if (!comment) return res.status(404).json({ success: false, error: 'Комментарий не найден' });
    if (comment.authorId !== req.user!.id && !(req.user!.roles || [req.user!.role]).includes('super_admin')) {
      return res.status(403).json({ success: false, error: 'Нельзя удалить чужой комментарий' });
    }
    run('DELETE FROM content_comments WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('DeleteComment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ─── Comments ──────────────────────────────────────────────────
