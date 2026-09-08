import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import dashboardRoutes from '../routes/dashboard';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/dashboard', dashboardRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
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
});
