import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import kanbanRoutes from '../routes/kanban';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/kanban', kanbanRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

describe('Kanban API', () => {
  describe('POST /api/kanban', () => {
    it('should create a task', async () => {
      const res = await request(app)
        .post('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Test Task', description: 'Desc', status: 'queue' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Task');
      expect(res.body.data.status).toBe('queue');
    });

    it('should default to queue status', async () => {
      const res = await request(app)
        .post('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Default Status Task' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('queue');
    });

    it('should reject task without title', async () => {
      const res = await request(app)
        .post('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ description: 'No title' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/kanban', () => {
    it('should return tasks', async () => {
      await request(app)
        .post('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Task 1' });
      await request(app)
        .post('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Task 2' });

      const res = await request(app)
        .get('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('PUT /api/kanban/:id', () => {
    it('should update task status', async () => {
      const create = await request(app)
        .post('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Move Me' });

      const res = await request(app)
        .put(`/api/kanban/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should update task priority', async () => {
      const create = await request(app)
        .post('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Priority Task' });

      const res = await request(app)
        .put(`/api/kanban/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ priority: 'high' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/kanban/:id', () => {
    it('should delete a task', async () => {
      const create = await request(app)
        .post('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Delete Me' });

      const res = await request(app)
        .delete(`/api/kanban/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/kanban/:id/archive', () => {
    it('should archive a task', async () => {
      const create = await request(app)
        .post('/api/kanban')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Archive Me' });

      const res = await request(app)
        .put(`/api/kanban/${create.body.data.id}/archive`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
    });
  });
});
