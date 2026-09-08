import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import partnersRoutes from '../routes/partners';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/partners', partnersRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

describe('Partners API', () => {
  describe('POST /api/partners', () => {
    it('should create a partner', async () => {
      const res = await request(app)
        .post('/api/partners')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          name: 'Test Company',
          type: 'client',
          contactPerson: 'John Doe',
          email: 'john@test.com',
          phone: '+7 999 123 4567',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Company');
    });

    it('should reject partner without name', async () => {
      const res = await request(app)
        .post('/api/partners')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ type: 'client' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Название обязательно');
    });
  });

  describe('GET /api/partners', () => {
    it('should return all partners', async () => {
      await request(app)
        .post('/api/partners')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Partner 1' });
      await request(app)
        .post('/api/partners')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Partner 2' });

      const res = await request(app)
        .get('/api/partners')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('PUT /api/partners/:id', () => {
    it('should update partner', async () => {
      const create = await request(app)
        .post('/api/partners')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Original' });

      const res = await request(app)
        .put(`/api/partners/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Updated', phone: '+7 000 000 0000' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent', async () => {
      const res = await request(app)
        .put('/api/partners/ghost')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/partners/:id', () => {
    it('should delete partner', async () => {
      const create = await request(app)
        .post('/api/partners')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Delete Me' });

      const res = await request(app)
        .delete(`/api/partners/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
