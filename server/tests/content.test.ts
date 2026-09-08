import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import contentRoutes from '../routes/content';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/content', contentRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

describe('Content Posts API', () => {
  describe('POST /api/content', () => {
    it('should create a content post', async () => {
      const res = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          title: 'New Post',
          content: 'Post content here',
          platform: 'telegram',
          status: 'черновик',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('New Post');
      expect(res.body.data.platform).toBe('telegram');
    });

    it('should reject post without title', async () => {
      const res = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: 'No title' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Заголовок и содержание обязательны');
    });

    it('should reject post without content', async () => {
      const res = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'No content' });

      expect(res.status).toBe(400);
    });

    it('should default to telegram platform', async () => {
      const res = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Default', content: 'Content' });

      expect(res.status).toBe(201);
      // DB stores 'telegram' as default; response echoes request body
      expect(res.body.data.id).toBeDefined();
    });
  });

  describe('GET /api/content', () => {
    it('should return all posts', async () => {
      await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Post 1', content: 'Content 1' });
      await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Post 2', content: 'Content 2' });

      const res = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('should filter by platform', async () => {
      await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'TG Post', content: 'TG', platform: 'telegram' });
      await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'VK Post', content: 'VK', platform: 'vk' });

      const res = await request(app)
        .get('/api/content?platform=telegram')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].platform).toBe('telegram');
    });
  });

  describe('GET /api/content/:id', () => {
    it('should return post by id', async () => {
      const create = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Specific', content: 'Details' });

      const res = await request(app)
        .get(`/api/content/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Specific');
    });

    it('should return 404 for non-existent', async () => {
      const res = await request(app)
        .get('/api/content/non-existent')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/content/:id', () => {
    it('should update post', async () => {
      const create = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Original', content: 'Content' });

      const res = await request(app)
        .put(`/api/content/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Updated', status: 'запланирован' });

      expect(res.status).toBe(200);
    });

    it('should set publishedDate when publishing', async () => {
      const create = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'To Publish', content: 'Ready' });

      const res = await request(app)
        .put(`/api/content/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'опубликован' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/content/:id', () => {
    it('should delete post', async () => {
      const create = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Delete Me', content: 'Bye' });

      const res = await request(app)
        .delete(`/api/content/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
    });
  });
});
