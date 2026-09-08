import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import eventsRoutes from '../routes/events';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/events', eventsRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

describe('Events API', () => {
  describe('POST /api/events', () => {
    it('should create an event', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          title: 'Team Building',
          description: 'Annual team event',
          date: '2025-06-15',
          location: 'Conference Hall',
          budget: 50000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Team Building');
    });
  });

  describe('GET /api/events', () => {
    it('should return all events', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PUT /api/events/:id', () => {
    it('should update event', async () => {
      const create = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Original Event' });

      const res = await request(app)
        .put(`/api/events/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Updated Event', status: 'completed' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('should delete event', async () => {
      const create = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Delete Me' });

      const res = await request(app)
        .delete(`/api/events/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
    });
  });
});
