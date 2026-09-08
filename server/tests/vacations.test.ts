import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import vacationsRoutes from '../routes/vacations';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/vacations', vacationsRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

describe('Vacations API', () => {
  describe('POST /api/vacations', () => {
    it('should create a vacation request', async () => {
      const res = await request(app)
        .post('/api/vacations')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          userId: 'test-editor-id',
          startDate: '2025-01-15',
          endDate: '2025-01-29',
          type: 'annual',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('annual');
    });
  });

  describe('GET /api/vacations', () => {
    it('should return all vacations', async () => {
      const res = await request(app)
        .get('/api/vacations')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PUT /api/vacations/:id', () => {
    it('should approve vacation', async () => {
      const create = await request(app)
        .post('/api/vacations')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          userId: 'test-editor-id',
          startDate: '2025-02-01',
          endDate: '2025-02-14',
          type: 'annual',
        });

      const res = await request(app)
        .put(`/api/vacations/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'approved', approvedBy: 'test-admin-id' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/vacations/:id', () => {
    it('should delete vacation', async () => {
      const create = await request(app)
        .post('/api/vacations')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          userId: 'test-editor-id',
          startDate: '2025-03-01',
          endDate: '2025-03-14',
        });

      const res = await request(app)
        .delete(`/api/vacations/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
    });
  });
});
