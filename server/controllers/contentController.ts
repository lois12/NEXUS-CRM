import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './notificationController';

// ─── Posts CRUD ────────────────────────────────────────────────

export const getAllPosts = (req: AuthRequest, res: Response) => {
  try {
    const { platform, status } = req.query;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const userRoles = req.user!.roles || [userRole];
    const isManager = userRoles.includes('super_admin') || userRoles.includes('руководитель');

    let sql = `
      SELECT cp.*, u.fullName as authorName, u.avatar as authorAvatar
      FROM content_posts cp
      LEFT JOIN users u ON cp.authorId = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Visibility: smm/редактор see own drafts + all non-drafts; руководители see all
    if (!isManager) {
      sql += " AND (cp.status != 'черновик' OR cp.authorId = ?)";
      params.push(userId);
    }

    if (platform && platform !== 'all') {
      sql += ' AND cp.platform = ?';
      params.push(platform);
    }

    if (status && status !== 'all') {
      sql += ' AND cp.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY cp.createdAt DESC';
    const posts = query(sql, params);
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
    res.json({ success: true, data: post });
  } catch (error) {
    console.error('GetPostById error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createPost = (req: AuthRequest, res: Response) => {
  try {
    const { title, content, platform, status, scheduledDate, imageUrl } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: 'Заголовок и содержание обязательны' });

    const id = uuidv4();
    const authorId = req.user!.id;

    run(`INSERT INTO content_posts (id, title, content, platform, status, scheduledDate, imageUrl, authorId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, content, platform || 'telegram', status || 'черновик', scheduledDate || null, imageUrl || null, authorId]);

    run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'post_created', `Создан пост: ${title}`, authorId]);

    res.status(201).json({ success: true, data: { id, title, content, platform, status, scheduledDate, imageUrl, authorId } });
  } catch (error) {
    console.error('CreatePost error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updatePost = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, platform, status, scheduledDate, imageUrl } = req.body;
    const post = get('SELECT * FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (platform !== undefined) { updates.push('platform = ?'); params.push(platform); }
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

// ─── Approval workflow ─────────────────────────────────────────

export const submitForApproval = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const post = get('SELECT * FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
    if (post.status !== 'черновик' && post.status !== 'на_доработку') {
      return res.status(400).json({ success: false, error: 'Можно отправить только черновик или пост на доработке' });
    }

    // Clean old approvals if resubmitting
    run('DELETE FROM content_approvals WHERE postId = ?', [id]);

    // Create approval records for all руководители
    const approvers = query("SELECT id, fullName FROM users WHERE role = 'руководитель' OR roles LIKE '%руководитель%'");
    for (const approver of approvers) {
      run('INSERT INTO content_approvals (id, postId, approverId) VALUES (?, ?, ?)', [uuidv4(), id, approver.id]);
      createNotification({
        userId: approver.id,
        type: 'content_status',
        title: 'Новый пост на согласование',
        body: `"${post.title}" от ${req.user!.username} ожидает согласования`,
        link: '/content',
        relatedId: id,
        senderId: req.user!.id,
      });
    }

    run("UPDATE content_posts SET status = 'запланирован', scheduledAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?", [id]);

    // Notify via socket
    const io = req.app.get('io');
    if (io) io.emit('content:status', { postId: id, status: 'запланирован', title: post.title });

    res.json({ success: true, message: 'Пост отправлен на согласование' });
  } catch (error) {
    console.error('SubmitForApproval error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const approvePost = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user!.id;

    const post = get('SELECT * FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
    if (post.status !== 'запланирован') return res.status(400).json({ success: false, error: 'Пост не на согласовании' });

    const approval = get('SELECT * FROM content_approvals WHERE postId = ? AND approverId = ?', [id, userId]);
    if (!approval) return res.status(403).json({ success: false, error: 'Вы не являетесь согласующим для этого поста' });

    run("UPDATE content_approvals SET action = 'approved', comment = ?, actedAt = datetime('now') WHERE id = ?", [comment || '', approval.id]);

    // Notify author
    createNotification({
      userId: post.authorId,
      type: 'content_status',
      title: 'Пост согласован',
      body: `"${post.title}" согласован ${req.user!.username}`,
      link: '/content',
      relatedId: id,
      senderId: userId,
    });

    // Check if all approvers approved
    const pending = get("SELECT COUNT(*) as count FROM content_approvals WHERE postId = ? AND action = 'pending'", [id]);
    if (pending && pending.count === 0) {
      run("UPDATE content_posts SET status = 'согласован', approvedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?", [id]);
      createNotification({
        userId: post.authorId,
        type: 'content_status',
        title: 'Пост полностью согласован',
        body: `"${post.title}" согласован всеми руководителями`,
        link: '/content',
        relatedId: id,
        senderId: userId,
      });
    }

    res.json({ success: true, message: 'Пост согласован' });
  } catch (error) {
    console.error('ApprovePost error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const requestRevision = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user!.id;

    if (!comment) return res.status(400).json({ success: false, error: 'Комментарий обязателен при отправке на доработку' });

    const post = get('SELECT * FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
    if (post.status !== 'запланирован') return res.status(400).json({ success: false, error: 'Пост не на согласовании' });

    const approval = get('SELECT * FROM content_approvals WHERE postId = ? AND approverId = ?', [id, userId]);
    if (!approval) return res.status(403).json({ success: false, error: 'Вы не являетесь согласующим' });

    run("UPDATE content_approvals SET action = 'revision', comment = ?, actedAt = datetime('now') WHERE id = ?", [comment, approval.id]);
    run("UPDATE content_posts SET status = 'на_доработку', rejectionReason = ?, updatedAt = datetime('now') WHERE id = ?", [comment, id]);

    createNotification({
      userId: post.authorId,
      type: 'content_status',
      title: 'Пост отправлен на доработку',
      body: `"${post.title}" — ${req.user!.username} просит доработать: ${comment.substring(0, 100)}`,
      link: '/content',
      relatedId: id,
      senderId: userId,
    });

    res.json({ success: true, message: 'Пост отправлен на доработку' });
  } catch (error) {
    console.error('RequestRevision error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const finalizePost = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const post = get('SELECT * FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
    if (post.status !== 'согласован') return res.status(400).json({ success: false, error: 'Пост должен быть согласован всеми' });

    run("UPDATE content_posts SET status = 'утверждён', finalizedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?", [id]);

    createNotification({
      userId: post.authorId,
      type: 'content_status',
      title: 'Пост утверждён',
      body: `"${post.title}" утверждён и готов к публикации`,
      link: '/content',
      relatedId: id,
      senderId: req.user!.id,
    });

    res.json({ success: true, message: 'Пост утверждён' });
  } catch (error) {
    console.error('FinalizePost error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const publishPost = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const post = get('SELECT * FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
    if (post.status !== 'утверждён') return res.status(400).json({ success: false, error: 'Пост должен быть утверждён' });

    run("UPDATE content_posts SET status = 'опубликован', publishedDate = datetime('now'), updatedAt = datetime('now') WHERE id = ?", [id]);

    run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'post_published', `Опубликован пост: ${post.title}`, req.user!.id]);

    // Notify author
    createNotification({
      userId: post.authorId,
      type: 'content_status',
      title: 'Пост опубликован',
      body: `"${post.title}" опубликован`,
      link: '/content',
      relatedId: id,
      senderId: req.user!.id,
    });

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

// ─── Approvals ─────────────────────────────────────────────────

export const getApprovals = (req: AuthRequest, res: Response) => {
  try {
    const { id: postId } = req.params;
    const approvals = query(`
      SELECT a.*, u.fullName as approverName, u.avatar as approverAvatar
      FROM content_approvals a LEFT JOIN users u ON a.approverId = u.id
      WHERE a.postId = ? ORDER BY a.createdAt ASC
    `, [postId]);
    res.json({ success: true, data: approvals });
  } catch (error) {
    console.error('GetApprovals error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
