import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { initDatabase, run, get } from '../db/database';
import { initializeDatabase } from '../db/init';
import { generateToken } from '../middleware/auth';
import chatRoutes from '../routes/chat';
import authRoutes from '../routes/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

let user1Token: string;
let user1Id: string;
let user2Token: string;
let user2Id: string;
let conversationId: string;
let messageId: string;

function createTestUser(username: string, fullName: string) {
  const id = uuidv4();
  const password = bcrypt.hashSync('test1234', 10);
  run('INSERT INTO users (id, username, password, fullName, email, role, roles) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, username, password, fullName, `${username}@test.com`, 'редактор', 'редактор']);
  const token = generateToken({ id, username, role: 'редактор', roles: ['редактор'] });
  return { token, user: { id, username, fullName, role: 'редактор' } };
}

beforeAll(async () => {
  await initDatabase(true); // fresh in-memory DB
  await initializeDatabase();

  const u1 = createTestUser('chatuser1', 'Chat User One');
  user1Token = u1.token;
  user1Id = u1.user.id;

  const u2 = createTestUser('chatuser2', 'Chat User Two');
  user2Token = u2.token;
  user2Id = u2.user.id;
});

describe('Chat API', () => {
  describe('Conversations', () => {
    it('create private conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ userId: user2Id });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('private');
      conversationId = res.body.data.id;
    });

    it('return existing conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ userId: user2Id });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(conversationId);
    });

    it('create group conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Test Group', memberIds: [user2Id] });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('group');
    });

    it('list conversations', async () => {
      const res = await request(app)
        .get('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Messages', () => {
    it('send text message', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Hello from user 1!' });

      expect(res.status).toBe(201);
      expect(res.body.data.content).toBe('Hello from user 1!');
      expect(res.body.data.senderId).toBe(user1Id);
      messageId = res.body.data.id;
    });

    it('send message with caption', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'img.jpg', type: 'image', caption: 'Look!' });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('image');
      expect(res.body.data.caption).toBe('Look!');
    });

    it('reject empty message', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });

    it('get messages', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('get messages with limit', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/messages?limit=1`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Reply', () => {
    it('send reply message', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ content: 'Replying!', replyToId: messageId });

      expect(res.status).toBe(201);
      expect(res.body.data.replyToId).toBe(messageId);
      expect(res.body.data.replyToContent).toBe('Hello from user 1!');
      expect(res.body.data.replyToSenderName).toBe('Chat User One');
    });
  });

  describe('Edit', () => {
    it('edit own message', async () => {
      const res = await request(app)
        .put(`/api/chat/messages/${messageId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Edited!' });

      expect(res.status).toBe(200);
    });

    it('reject editing others message', async () => {
      const res = await request(app)
        .put(`/api/chat/messages/${messageId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ content: 'Hacked!' });

      expect(res.status).toBe(403);
    });
  });

  describe('Reactions', () => {
    it('add reaction', async () => {
      const res = await request(app)
        .post(`/api/chat/messages/${messageId}/reactions`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ emoji: '👍' });

      expect(res.status).toBe(201);
      expect(res.body.data.some((r: any) => r.emoji === '👍')).toBe(true);
    });

    it('remove reaction', async () => {
      const res = await request(app)
        .delete(`/api/chat/messages/${messageId}/reactions`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Pin', () => {
    it('pin message', async () => {
      const res = await request(app)
        .post(`/api/chat/messages/${messageId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(201);
    });

    it('get pinned messages', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/pinned`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('unpin message', async () => {
      const res = await request(app)
        .delete(`/api/chat/messages/${messageId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Forward', () => {
    it('forward message', async () => {
      const res = await request(app)
        .post(`/api/chat/messages/${messageId}/forward`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId });

      expect(res.status).toBe(201);
      expect(res.body.data.forwardedFrom).toBe('Chat User One');
    });
  });

  describe('Typing & Read', () => {
    it('set typing', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/typing`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
    });

    it('mark as read', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Unread count', () => {
    it('get unread count', async () => {
      const res = await request(app)
        .get('/api/chat/unread')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.data.total).toBe('number');
    });
  });

  describe('Delete', () => {
    it('delete own message', async () => {
      const msg = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'To be deleted' });

      const res = await request(app)
        .delete(`/api/chat/messages/${msg.body.data.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
    });

    it('reject deleting others message', async () => {
      const res = await request(app)
        .delete(`/api/chat/messages/${messageId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Search', () => {
    it('search messages', async () => {
      const res = await request(app)
        .get('/api/chat/search?q=Edited')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Group management', () => {
    let groupId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Manage Group', memberIds: [user2Id] });
      groupId = res.body.data.id;
    });

    it('get group members', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${groupId}/members`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('add member', async () => {
      const u3 = createTestUser('chatuser3', 'Chat User Three');

      const res = await request(app)
        .post(`/api/chat/conversations/${groupId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ userId: u3.user.id });

      expect(res.status).toBe(201);
    });

    it('remove member', async () => {
      const members = await request(app)
        .get(`/api/chat/conversations/${groupId}/members`)
        .set('Authorization', `Bearer ${user1Token}`);

      const toRemove = members.body.data.find((m: any) => m.userId !== user1Id);
      if (toRemove) {
        const res = await request(app)
          .delete(`/api/chat/conversations/${groupId}/members/${toRemove.userId}`)
          .set('Authorization', `Bearer ${user1Token}`);

        expect(res.status).toBe(200);
      }
    });
  });
});
