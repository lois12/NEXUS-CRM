import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const app = express();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

describe('Health Check', () => {
  it('should return ok status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('should return valid timestamp', async () => {
    const res = await request(app).get('/api/health');

    const timestamp = new Date(res.body.timestamp);
    expect(timestamp.getTime()).not.toBeNaN();
  });
});
