import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

export const getAllUsers = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const users = query(`
      SELECT id, username, email, fullName, role, roles, avatar, createdAt, updatedAt
      FROM users ORDER BY createdAt DESC LIMIT ?
    `, [limit]);

    // Parse roles for each user
    const parsed = users.map((u: any) => ({
      ...u,
      roles: u.roles ? u.roles.split(',').map((r: string) => r.trim()) : [u.role],
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('GetAllUsers error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getUserById = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = get('SELECT id, username, email, fullName, role, roles, avatar, createdAt, updatedAt FROM users WHERE id = ?', [id]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    const roles = (user as any).roles ? (user as any).roles.split(',').map((r: string) => r.trim()) : [(user as any).role];
    res.json({ success: true, data: { ...user, roles } });
  } catch (error) {
    console.error('GetUserById error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createUser = (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, fullName, role, roles } = req.body;

    if (!username || !password || !email || !fullName) {
      return res.status(400).json({ success: false, error: 'Все поля обязательны' });
    }

    const existingUser = get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    // Only super_admin can create super_admin; others get 'редактор' default
    const callerRoles = req.user?.roles || [req.user?.role || ''];
    const isCallerSuperAdmin = callerRoles.includes('super_admin');
    let finalRole = role || (roles && roles[0]) || 'редактор';
    let finalRoles = roles ? (Array.isArray(roles) ? roles.join(',') : roles) : finalRole;
    if (!isCallerSuperAdmin && (finalRole === 'super_admin' || (finalRoles && finalRoles.includes('super_admin')))) {
      finalRole = 'редактор';
      finalRoles = 'редактор';
    }

    run('INSERT INTO users (id, username, password, email, fullName, role, roles) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, username, hashedPassword, email, fullName, finalRole, finalRoles]);

    run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'user_created', `Создан пользователь: ${fullName}`, id]);

    res.status(201).json({
      success: true,
      data: { id, username, email, fullName, role: finalRole, roles: finalRoles.split(',') },
    });
  } catch (error) {
    console.error('CreateUser error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateUser = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, roles, password } = req.body;

    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (fullName !== undefined) { updates.push('fullName = ?'); params.push(fullName); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (roles) {
      const rolesStr = Array.isArray(roles) ? roles.join(',') : roles;
      updates.push('roles = ?'); params.push(rolesStr);
      // Also update primary role to first in list
      if (!role && Array.isArray(roles) && roles.length > 0) {
        updates.push('role = ?'); params.push(roles[0]);
      }
    }
    if (password) { updates.push('password = ?'); params.push(bcrypt.hashSync(password, 10)); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Пользователь обновлен' });
  } catch (error) {
    console.error('UpdateUser error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadAvatar = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'Файл не загружен' });
    }

    const user = get('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    const avatarUrl = `/uploads/${file.filename}`;
    run("UPDATE users SET avatar = ?, updatedAt = datetime('now') WHERE id = ?", [avatarUrl, id]);

    res.json({ success: true, data: { avatar: avatarUrl } });
  } catch (error) {
    console.error('UploadAvatar error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateMyAvatar = (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'Файл не загружен' });
    }

    const avatarUrl = `/uploads/${file.filename}`;
    run("UPDATE users SET avatar = ?, updatedAt = datetime('now') WHERE id = ?", [avatarUrl, req.user?.id]);

    res.json({ success: true, data: { avatar: avatarUrl } });
  } catch (error) {
    console.error('UpdateMyAvatar error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateMyProfile = (req: AuthRequest, res: Response) => {
  try {
    const { fullName, position, about, status, socialLinks } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (fullName !== undefined) { updates.push('fullName = ?'); params.push(fullName); }
    if (position !== undefined) { updates.push('position = ?'); params.push(position); }
    if (about !== undefined) { updates.push('about = ?'); params.push(about); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (socialLinks !== undefined) { updates.push('socialLinks = ?'); params.push(JSON.stringify(socialLinks)); }

    updates.push("updatedAt = datetime('now')");
    params.push(req.user?.id);

    if (updates.length > 1) {
      run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const user = get('SELECT * FROM users WHERE id = ?', [req.user?.id]);
    res.json({ success: true, data: {
      id: user.id, username: user.username, email: user.email, fullName: user.fullName,
      role: user.role, roles: user.roles ? user.roles.split(',') : [user.role],
      avatar: user.avatar, position: user.position, about: user.about,
      status: user.status, socialLinks: (() => { try { return user.socialLinks ? JSON.parse(user.socialLinks) : {}; } catch { return {}; } })(),
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    }});
  } catch (error) {
    console.error('UpdateMyProfile error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteUser = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      return res.status(400).json({ success: false, error: 'Нельзя удалить самого себя' });
    }

    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    // Cascade: clean up related records before deleting user
    run('DELETE FROM kanban_tasks WHERE userId = ?', [id]);
    run('DELETE FROM activities WHERE userId = ?', [id]);
    run('DELETE FROM idea_comments WHERE authorId = ?', [id]);
    run('DELETE FROM idea_attachments WHERE uploadedBy = ?', [id]);
    run('DELETE FROM content_comments WHERE authorId = ?', [id]);
    run('DELETE FROM content_approvals WHERE approverId = ?', [id]);
    run('UPDATE chat_messages SET deleted = 1, content = "[Удалено]" WHERE senderId = ?', [id]);
    run('DELETE FROM chat_group_members WHERE userId = ?', [id]);
    run('DELETE FROM chat_reads WHERE userId = ?', [id]);
    run('DELETE FROM chat_pinned WHERE pinnedBy = ?', [id]);
    run('DELETE FROM chat_reactions WHERE userId = ?', [id]);
    run('DELETE FROM vacations WHERE userId = ?', [id]);
    run('DELETE FROM notifications WHERE userId = ? OR senderId = ?', [id, id]);
    run('DELETE FROM materials WHERE uploadedBy = ?', [id]);
    run('DELETE FROM brand_assets WHERE uploadedBy = ?', [id]);
    run('DELETE FROM knowledge_base WHERE authorId = ?', [id]);
    run('DELETE FROM push_subscriptions WHERE userId = ?', [id]);
    run('DELETE FROM qr_codes WHERE createdBy = ?', [id]);
    run('DELETE FROM image_gen_log WHERE userId = ?', [id]);

    // Log activity BEFORE deleting user (so userId is still valid)
    run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'user_deleted', `Удален пользователь: ${(user as any).fullName}`, req.user?.id || '']);

    run('DELETE FROM users WHERE id = ?', [id]);

    res.json({ success: true, message: 'Пользователь удален' });
  } catch (error) {
    console.error('DeleteUser error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
