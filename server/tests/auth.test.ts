import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'test123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.username).toBe('testadmin');
      expect(res.body.data.user.fullName).toBe('Test Admin');
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Неверный логин или пароль');
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'test123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Введите логин и пароль');
    });

    it('should return user roles on login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'test123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).toContain('руководитель');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const token = generateToken({
        id: 'test-admin-id',
        username: 'testadmin',
        role: 'руководитель',
        roles: ['руководитель', 'редактор'],
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('testadmin');
      expect(res.body.data.email).toBe('test@nexus.ru');
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Требуется авторизация');
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const token = generateToken({
        id: 'test-admin-id',
        username: 'testadmin',
        role: 'руководитель',
        roles: ['руководитель'],
      });

      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'newuser',
          password: 'password123',
          email: 'new@nexus.ru',
          fullName: 'New User',
          role: 'редактор',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('newuser');
    });

    it('should reject duplicate username', async () => {
      const token = generateToken({
        id: 'test-admin-id',
        username: 'testadmin',
        role: 'руководитель',
        roles: ['руководитель'],
      });

      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'testadmin',
          password: 'password123',
          email: 'another@nexus.ru',
          fullName: 'Another User',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Пользователь уже существует');
    });

    it('should reject missing required fields', async () => {
      const token = generateToken({
        id: 'test-admin-id',
        username: 'testadmin',
        role: 'руководитель',
        roles: ['руководитель'],
      });

      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'incomplete' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Все поля обязательны');
    });
  });
});
