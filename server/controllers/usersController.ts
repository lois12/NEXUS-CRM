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

    // Cascade: clean up / reassign related records before deleting user.
    // Many FKs are NOT NULL (senderId, authorId, createdBy) — reassign to the acting admin.
    // silent=true: optional/migration tables may be absent on older schemas
    const actorId = req.user?.id || id;
    const sweep = (sql: string, params: any[]) => run(sql, params, true);

    // Conversations reference users as NOT NULL — reassign ownership
    sweep('UPDATE chat_conversations SET user1Id = ? WHERE user1Id = ?', [actorId, id]);
    sweep('UPDATE chat_conversations SET user2Id = ? WHERE user2Id = ?', [actorId, id]);

    sweep('DELETE FROM kanban_tasks WHERE userId = ?', [id]);
    sweep('DELETE FROM activities WHERE userId = ?', [id]);
    sweep('DELETE FROM idea_comments WHERE authorId = ?', [id]);
    sweep('DELETE FROM idea_attachments WHERE uploadedBy = ?', [id]);
    sweep('DELETE FROM content_comments WHERE authorId = ?', [id]);
    sweep('DELETE FROM content_approvals WHERE approverId = ?', [id]);
    // chat: keep history, scrub author (senderId is NOT NULL)
    sweep("UPDATE chat_messages SET deleted = 1, content = '[Удалено]', senderId = ? WHERE senderId = ?", [actorId, id]);
    sweep('DELETE FROM chat_group_members WHERE userId = ?', [id]);
    sweep('DELETE FROM chat_reads WHERE userId = ?', [id]);
    sweep('DELETE FROM chat_pinned WHERE pinnedBy = ?', [id]);
    sweep('DELETE FROM chat_reactions WHERE userId = ?', [id]);
    sweep('DELETE FROM chat_favorites WHERE userId = ?', [id]);
    sweep('DELETE FROM chat_user_mutes WHERE userId = ?', [id]);
    sweep('DELETE FROM chat_muted WHERE userId = ? OR mutedBy = ?', [id, id]);
    sweep('DELETE FROM chat_hidden WHERE userId = ?', [id]);
    sweep('DELETE FROM chat_poll_votes WHERE userId = ?', [id]);
    sweep('UPDATE chat_polls SET createdBy = ? WHERE createdBy = ?', [actorId, id]);
    sweep('DELETE FROM vacations WHERE userId = ?', [id]);
    sweep('UPDATE vacations SET approvedBy = NULL WHERE approvedBy = ?', [id]);
    sweep('DELETE FROM notifications WHERE userId = ? OR senderId = ?', [id, id]);
    sweep('DELETE FROM materials WHERE uploadedBy = ?', [id]);
    sweep('DELETE FROM brand_assets WHERE uploadedBy = ?', [id]);
    sweep('DELETE FROM knowledge_attachments WHERE uploadedBy = ?', [id]);
    sweep('DELETE FROM knowledge_base WHERE authorId = ?', [id]);
    sweep('DELETE FROM push_subscriptions WHERE userId = ?', [id]);
    sweep('DELETE FROM qr_codes WHERE createdBy = ?', [id]);
    sweep('DELETE FROM image_gen_log WHERE userId = ?', [id]);
    sweep('DELETE FROM feedback_messages WHERE userId = ?', [id]);
    // ownership NOT NULL → reassign to admin so FK allows user delete
    sweep('UPDATE content_posts SET authorId = ? WHERE authorId = ?', [actorId, id]);
    sweep('UPDATE ideas SET authorId = ? WHERE authorId = ?', [actorId, id]);
    sweep('UPDATE lists SET createdBy = ? WHERE createdBy = ?', [actorId, id]);
    sweep('UPDATE widgets SET createdBy = ? WHERE createdBy = ?', [actorId, id]);
    sweep('UPDATE registrations SET createdBy = ? WHERE createdBy = ?', [actorId, id]);
    sweep('UPDATE collage_projects SET ownerId = ? WHERE ownerId = ?', [actorId, id]);
    sweep('UPDATE short_links SET createdBy = ? WHERE createdBy = ?', [actorId, id]);
    sweep('UPDATE knowledge_attachments SET uploadedBy = NULL WHERE uploadedBy = ?', [id]);
    sweep('UPDATE projects SET createdBy = ? WHERE createdBy = ?', [actorId, id]);
    sweep('UPDATE ideas SET userId = ? WHERE userId = ?', [actorId, id]);
    sweep('DELETE FROM idea_links WHERE userId = ?', [id]);

    // Dynamic fallback: any remaining FK to users → delete child rows
    try {
      const tables = query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
      for (const t of tables) {
        if (t.name === 'users' || t.name === 'schema_migrations') continue;
        let fks: any[] = [];
        try {
          fks = query(`PRAGMA foreign_key_list("${t.name}")`);
        } catch {
          continue;
        }
        for (const fk of fks) {
          if (fk?.table !== 'users') continue;
          const col = fk.from;
          if (!col || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) continue;
          // reassign optional owners, delete pure child rows
          try {
            run(`DELETE FROM "${t.name}" WHERE "${col}" = ?`, [id], true);
          } catch {
            try {
              run(`UPDATE "${t.name}" SET "${col}" = ? WHERE "${col}" = ?`, [actorId, id], true);
            } catch { /* leave it — final DELETE will surface the issue */ }
          }
        }
      }
    } catch (e) {
      console.error('DeleteUser FK sweep warn:', e);
    }

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
