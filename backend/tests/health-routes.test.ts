import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Prisma'yı mock'luyoruz çünkü test ortamında gerçek DB yok.
vi.mock('../src/config/database', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

// Redis'i de mock'luyoruz (REDIS_URL yok zaten ama yine de güvence)
vi.mock('../src/config/redis', () => ({
  getRedis: () => null,
  isRedisHealthy: () => false,
}));

import healthRoutes from '../src/routes/health.routes';

describe('Health endpoints', () => {
  const app = express();
  app.use('/health', healthRoutes);

  it('GET /health → 200 + status:healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /health/db → DB mock\'lu olduğu için 200', async () => {
    const res = await request(app).get('/health/db');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.latencyMs).toBeDefined();
  });

  it('GET /health/redis → REDIS_URL yok → 503 (degraded)', async () => {
    const res = await request(app).get('/health/redis');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });

  it('GET /health/full → DB ok + Redis fail → status: ok (redis opsiyonel)', async () => {
    const res = await request(app).get('/health/full');
    expect(res.status).toBe(200);
    expect(res.body.checks.db.ok).toBe(true);
    expect(res.body.checks.redis.ok).toBe(false);
  });
});
