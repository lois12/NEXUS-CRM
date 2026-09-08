import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { get, run } from '../db/database';
import { generateToken, AuthRequest } from '../middleware/auth';
import { recordFailedAttempt, recordSuccessfulLogin } from '../middleware/rateLimit';

export const login = (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Введите логин и пароль' });
    }

    const user = get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      recordFailedAttempt(ip);
      return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      recordFailedAttempt(ip);
      return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
    }

    // Success — clear rate limit
    recordSuccessfulLogin(ip);

    const roles = user.roles ? user.roles.split(',').map((r: string) => r.trim()) : [user.role];
    const token = generateToken({ id: user.id, username: user.username, role: user.role, roles });

    // Log activity
    run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'user_login', `Пользователь ${user.fullName} вошел в систему`, user.id]);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          roles,
          avatar: user.avatar,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const register = (req: AuthRequest, res: Response) => {
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
    // Ignore client-supplied role/roles — always create as 'редактор'
    const finalRole = 'редактор';
    const finalRoles = 'редактор';

    run('INSERT INTO users (id, username, password, email, fullName, role, roles) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, username, hashedPassword, email, fullName, finalRole, finalRoles]);

    run(`INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'user_created', `Создан новый пользователь: ${fullName}`, id]);

    res.status(201).json({
      success: true,
      data: { id, username, email, fullName, role: finalRole, roles: finalRoles.split(',') },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getMe = (req: AuthRequest, res: Response) => {
  try {
    const user = get('SELECT * FROM users WHERE id = ?', [req.user?.id]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    const roles = user.roles ? user.roles.split(',').map((r: string) => r.trim()) : [user.role];

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        roles,
        avatar: user.avatar,
        position: user.position || '',
        about: user.about || '',
        status: user.status || '',
        socialLinks: (() => { try { return user.socialLinks ? JSON.parse(user.socialLinks) : {}; } catch { return {}; } })(),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
