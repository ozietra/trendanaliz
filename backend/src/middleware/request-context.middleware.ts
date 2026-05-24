import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

/**
 * Request Context Middleware
 *
 * - Her isteğe benzersiz bir `requestId` atar (gelen header'da varsa onu
 *   kullanır; aksi halde UUID üretir). Header: `X-Request-Id`.
 * - İstek üzerine bağlamı taşıyan bir child logger ekler: `req.log`.
 * - Yanıta `X-Request-Id` header'ı koyar (front-end loglarında izlenebilir).
 * - İsteğin tamamlanma süresini ölçer; finish/close event'inde özet log atar.
 *
 * Express 5 ile birlikte gelen native Promise hata yönetimi kullanılabilir.
 */

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    log: ReturnType<typeof logger.child>;
  }
}

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incoming = req.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

  req.requestId = requestId;
  req.log = logger.child({ requestId, method: req.method, path: req.path });
  res.setHeader('X-Request-Id', requestId);

  const start = process.hrtime.bigint();
  let logged = false;

  const logFinish = (event: string) => {
    if (logged) return;
    logged = true;
    const durMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
    const meta = {
      status: res.statusCode,
      durationMs: durMs,
      ip: req.ip,
      ua: req.headers['user-agent'],
      event,
    };
    if (res.statusCode >= 500) req.log.error('http_request', meta);
    else if (res.statusCode >= 400) req.log.warn('http_request', meta);
    else req.log.http('http_request', meta);
  };

  res.on('finish', () => logFinish('finish'));
  res.on('close', () => logFinish('close'));

  next();
};
