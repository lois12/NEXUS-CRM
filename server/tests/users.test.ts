import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import usersRoutes from '../routes/users';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/users', usersRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель', 'редактор'],
  });
}

describe('Users API', () => {
  describe('GET /api/users', () => {
    it('should return all users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by id', async () => {
      const res = await request(app)
        .get('/api/users/test-admin-id')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('testadmin');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Пользователь не найден');
    });
  });

  describe('POST /api/users', () => {
    it('should create new user', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          username: 'createduser',
          password: 'pass123',
          email: 'created@nexus.ru',
          fullName: 'Created User',
          role: 'редактор',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('createduser');
    });

    it('should reject duplicate username', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          username: 'testadmin',
          password: 'pass123',
          email: 'dup@nexus.ru',
          fullName: 'Dup User',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Пользователь уже существует');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user', async () => {
      const res = await request(app)
        .put('/api/users/test-editor-id')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ fullName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .put('/api/users/non-existent')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ fullName: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user', async () => {
      const res = await request(app)
        .delete('/api/users/test-editor-id')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should not allow self-deletion', async () => {
      const res = await request(app)
        .delete('/api/users/test-admin-id')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Нельзя удалить самого себя');
    });
  });
});
