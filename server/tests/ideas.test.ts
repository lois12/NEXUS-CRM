import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import ideasRoutes from '../routes/ideas';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/ideas', ideasRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

describe('Ideas API', () => {
  describe('POST /api/ideas', () => {
    it('should create an idea', async () => {
      const res = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Test Idea', content: 'Description', type: 'idea' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Idea');
      expect(res.body.data.type).toBe('idea');
    });

    it('should reject idea without title', async () => {
      const res = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: 'No title' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Заголовок обязателен');
    });

    it('should auto-assign color based on type', async () => {
      const res = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Colored Idea', type: 'task' });

      expect(res.status).toBe(201);
      expect(res.body.data.color).toBe('#00ff88');
    });
  });

  describe('GET /api/ideas', () => {
    it('should return ideas and links', async () => {
      // Create some ideas first
      await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Idea 1' });
      await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Idea 2' });

      const res = await request(app)
        .get('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ideas).toBeDefined();
      expect(res.body.data.links).toBeDefined();
      expect(res.body.data.ideas.length).toBe(2);
    });
  });

  describe('PUT /api/ideas/:id', () => {
    it('should update an idea', async () => {
      const createRes = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Original' });

      const id = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/ideas/${id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Updated', color: '#ff0000' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent idea', async () => {
      const res = await request(app)
        .put('/api/ideas/non-existent')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/ideas/:id', () => {
    it('should delete an idea', async () => {
      const createRes = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'To Delete' });

      const id = createRes.body.data.id;

      const res = await request(app)
        .delete(`/api/ideas/${id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/ideas/link', () => {
    it('should create a link between ideas', async () => {
      const idea1 = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Source' });
      const idea2 = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Target' });

      const res = await request(app)
        .post('/api/ideas/link')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ sourceId: idea1.body.data.id, targetId: idea2.body.data.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject duplicate link', async () => {
      const idea1 = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'A' });
      const idea2 = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'B' });

      await request(app)
        .post('/api/ideas/link')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ sourceId: idea1.body.data.id, targetId: idea2.body.data.id });

      const res = await request(app)
        .post('/api/ideas/link')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ sourceId: idea1.body.data.id, targetId: idea2.body.data.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Связь уже существует');
    });
  });

  describe('Comments', () => {
    it('should add and retrieve comments', async () => {
      const idea = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Commented Idea' });

      const ideaId = idea.body.data.id;

      await request(app)
        .post(`/api/ideas/${ideaId}/comments`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: 'First comment' });

      const res = await request(app)
        .get(`/api/ideas/${ideaId}/comments`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].content).toBe('First comment');
    });

    it('should reject empty comment', async () => {
      const idea = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Idea' });

      const res = await request(app)
        .post(`/api/ideas/${idea.body.data.id}/comments`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });
  });
});
