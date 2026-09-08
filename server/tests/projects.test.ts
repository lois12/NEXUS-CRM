import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import projectsRoutes from '../routes/projects';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/projects', projectsRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

describe('Projects API', () => {
  describe('POST /api/projects', () => {
    it('should create a project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          title: 'New Website',
          description: 'Company website redesign',
          status: 'active',
          priority: 'high',
          startDate: '2025-01-01',
          endDate: '2025-03-01',
          budget: 500000,
          progress: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('New Website');
    });
  });

  describe('GET /api/projects', () => {
    it('should return all projects', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update project progress', async () => {
      const create = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Project X' });

      const res = await request(app)
        .put(`/api/projects/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ progress: 50, status: 'in_progress' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete project', async () => {
      const create = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Delete Me' });

      const res = await request(app)
        .delete(`/api/projects/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
    });
  });
});
