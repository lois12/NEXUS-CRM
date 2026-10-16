import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import dashboardRoutes from '../routes/dashboard';
import { generateToken } from '../middleware/auth';
import { run } from '../db/database';
import { setupTestDb } from './helpers/testDb';

const app = express();
app.use(express.json());

beforeAll(() => {
  setupTestDb();
});
app.use('/api/dashboard', dashboardRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

function superToken(id: string, username: string) {
  return generateToken({ id, username, role: 'super_admin', roles: ['super_admin'] });
}

describe('Dashboard API', () => {
  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/online (Team Pulse)', () => {
    it('should list recently-active users and require super_admin', async () => {
      const superId = uuidv4();
      const hash = bcrypt.hashSync('test123', 10);
      run(
        `INSERT INTO users (id, username, password, fullName, email, role, roles, lastSeen)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [superId, 'pulseadmin', hash, 'Pulse Admin', 'pulse@test.local', 'super_admin', 'super_admin'],
      );

      // Not super_admin → 403
      const denied = await request(app)
        .get('/api/dashboard/online')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(denied.status).toBe(403);

      // super_admin → 200, and the just-seeded user counts as online (lastSeen = now)
      const res = await request(app)
        .get('/api/dashboard/online')
        .set('Authorization', `Bearer ${superToken(superId, 'pulseadmin')}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.online)).toBe(true);
      expect(Array.isArray(res.body.data.recent)).toBe(true);
      expect(res.body.data.totalUsers).toBeGreaterThan(0);
      expect(res.body.data.online.some((u: any) => u.id === superId)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/dashboard/online');
      expect(res.status).toBe(401);
    });
  });
});
