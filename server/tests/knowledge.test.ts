import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import knowledgeRoutes from '../routes/knowledge';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/knowledge', knowledgeRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

describe('Knowledge Base API', () => {
  describe('POST /api/knowledge', () => {
    it('should create knowledge article', async () => {
      const res = await request(app)
        .post('/api/knowledge')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          title: 'How to use CRM',
          content: 'Step by step guide...',
          category: 'guides',
          tags: 'crm,tutorial',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('How to use CRM');
    });
  });

  describe('GET /api/knowledge', () => {
    it('should return all articles', async () => {
      await request(app)
        .post('/api/knowledge')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Article 1', content: 'Content 1' });
      await request(app)
        .post('/api/knowledge')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Article 2', content: 'Content 2' });

      const res = await request(app)
        .get('/api/knowledge')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('PUT /api/knowledge/:id', () => {
    it('should update article', async () => {
      const create = await request(app)
        .post('/api/knowledge')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Original', content: 'Original content' });

      const res = await request(app)
        .put(`/api/knowledge/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Updated', content: 'New content' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/knowledge/:id', () => {
    it('should delete article', async () => {
      const create = await request(app)
        .post('/api/knowledge')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Delete Me' });

      const res = await request(app)
        .delete(`/api/knowledge/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
    });
  });
});
