import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { getRedis, isRedisHealthy } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Sağlık Kontrol Endpoint'leri
 *
 *  - GET /health        → Hızlı liveness probe; sadece "OK" döner.
 *  - GET /health/db     → Postgres'e SELECT 1; gecikme + sürüm.
 *  - GET /health/redis  → Redis'e PING; sağlıklı mı?
 *  - GET /health/full   → Tüm bağımlılıkların durumu, total status.
 *
 * Liveness ile readiness arasındaki ayrım:
 *  - /health  : K8s liveness probe — process ayakta mı?
 *  - /health/full : K8s readiness probe — trafik alabilir mi?
 */

const router = Router();

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
  meta?: Record<string, unknown>;
}

const checkDb = async (): Promise<CheckResult> => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
  }
};

const checkRedis = async (): Promise<CheckResult> => {
  const r = getRedis();
  if (!r) {
    return {
      ok: false,
      error: 'REDIS_URL tanımlı değil; bellek-içi fallback aktif (multi-process güvenli değil).',
    };
  }
  const start = Date.now();
  try {
    const pong = await r.ping();
    return {
      ok: pong === 'PONG' && isRedisHealthy(),
      latencyMs: Date.now() - start,
      meta: { pong },
    };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
  }
};

router.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
});

router.get('/db', async (_req: Request, res: Response) => {
  const r = await checkDb();
  return res.status(r.ok ? 200 : 503).json({ success: r.ok, ...r });
});

router.get('/redis', async (_req: Request, res: Response) => {
  const r = await checkRedis();
  return res.status(r.ok ? 200 : 503).json({ success: r.ok, ...r });
});

router.get('/full', async (_req: Request, res: Response) => {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
  // Redis opsiyonel olduğu için "fail" sayma — sadece raporla
  const overall = db.ok;
  const body = {
    success: overall,
    status: overall ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
    checks: { db, redis },
  };
  if (!overall) {
    logger.warn('Health/full degraded', body);
  }
  return res.status(overall ? 200 : 503).json(body);
});

export default router;
