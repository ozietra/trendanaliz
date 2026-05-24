import { Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Server-Sent Events (SSE) hub'ı.
 *
 * - Process içi bellek tabanlı (tek node için yeterli, MVP).
 * - Çok node'lu bir setup'a geçildiğinde Redis pub/sub ile değiştirilebilir.
 * - Bağlantı havuzu user-bazlı: bir kullanıcının birden çok sekmesi olabilir.
 */

interface Client {
  id: number;
  userId: string;
  res: Response;
}

const clients = new Map<number, Client>();
let clientCounter = 0;

const HEARTBEAT_INTERVAL_MS = 25_000;

// 25 saniyede bir tüm bağlantılara comment gönder (proxy zaman aşımlarını önlemek için)
setInterval(() => {
  for (const c of clients.values()) {
    try {
      c.res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      // Sessizce yoksay
    }
  }
}, HEARTBEAT_INTERVAL_MS);

/**
 * Yeni bir SSE bağlantısı kaydeder.
 */
export const registerClient = (userId: string, res: Response): (() => void) => {
  const id = ++clientCounter;
  clients.set(id, { id, userId, res });

  // İlk olay: bağlantı onaylama
  try {
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  } catch (err) {
    logger.warn(`SSE register write failed: ${(err as Error).message}`);
  }

  logger.debug(`SSE client connected (#${id}, user=${userId}, total=${clients.size})`);

  return () => {
    clients.delete(id);
    logger.debug(`SSE client disconnected (#${id}, total=${clients.size})`);
  };
};

/**
 * Tek bir kullanıcıya event yayınlar.
 */
export const publishToUser = (userId: string, event: string, payload: unknown): void => {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients.values()) {
    if (c.userId !== userId) continue;
    try {
      c.res.write(data);
    } catch (err) {
      logger.warn(`SSE write failed (user=${userId}): ${(err as Error).message}`);
      clients.delete(c.id);
    }
  }
};

/**
 * Bağlı kullanıcı sayısı (debug için).
 */
export const getConnectedClients = (): number => clients.size;
