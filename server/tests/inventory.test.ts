import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import inventoryRoutes from '../routes/inventory';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/inventory', inventoryRoutes);

function adminToken() {
  return generateToken({
    id: 'test-admin-id',
    username: 'testadmin',
    role: 'руководитель',
    roles: ['руководитель'],
  });
}

describe('Inventory API', () => {
  describe('POST /api/inventory', () => {
    it('should create inventory item', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          name: 'Test Laptop',
          type: 'ТМЦ',
          quantity: 1,
          unit: 'шт',
          location: 'Office 1',
          serialNumber: 'SN-001',
          purchasePrice: 50000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Laptop');
    });
  });

  describe('GET /api/inventory', () => {
    it('should return all inventory items', async () => {
      await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Item 1' });
      await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Item 2' });

      const res = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('PUT /api/inventory/:id', () => {
    it('should update inventory item', async () => {
      const create = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Original' });

      const res = await request(app)
        .put(`/api/inventory/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Updated', location: 'Warehouse' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/inventory/:id', () => {
    it('should delete inventory item', async () => {
      const create = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Delete Me' });

      const res = await request(app)
        .delete(`/api/inventory/${create.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
    });
  });
});
