import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { registerClient } from '../services/realtime.service';
import { env } from '../config/env';
import {
  getUserNotificationPrefs,
  updateUserNotificationPrefs,
  DEFAULT_PREFS,
} from '../services/notification.service';
import { z } from 'zod';

/**
 * GET /api/notifications
 * Kullanıcının son 50 bildirimini getirir.
 */
export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const items = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return res.json({
      success: true,
      data: items,
      unreadCount,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Bildirim listesi hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Bildirimler yüklenemedi.' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Tek bir bildirimi okundu olarak işaretler.
 */
export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const notif = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Bildirim bulunamadı.' });
    }
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Bildirim okundu işaretleme hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'İşlem başarısız.' });
  }
};

/**
 * POST /api/notifications/read-all
 * Tüm okunmamış bildirimleri okundu olarak işaretler.
 */
export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Toplu okundu hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'İşlem başarısız.' });
  }
};

/**
 * GET /api/notifications/preferences
 * Kullanıcının her olay türü için bildirim kanalı tercihini döner.
 * Yanıt formatı: { events: [...isimler], channels: ['IN_APP','EMAIL','SMS'], prefs: { event: [chans] } }
 */
export const getPreferences = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }
  try {
    const prefs = await getUserNotificationPrefs(userId);
    return res.json({
      success: true,
      data: {
        events: Object.keys(DEFAULT_PREFS),
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        prefs,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Bildirim tercihleri okunamadı: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Tercihler yüklenemedi.' });
  }
};

const channelSchema = z.array(z.enum(['IN_APP', 'EMAIL', 'SMS']));
const prefsPatchSchema = z.record(z.string(), channelSchema);

/**
 * PUT /api/notifications/preferences
 * Body: { prefs: { EVENT_NAME: ["IN_APP","EMAIL"], ... } }
 */
export const updatePreferences = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }
  const parsed = prefsPatchSchema.safeParse(req.body?.prefs ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Geçersiz tercih formatı.',
      issues: parsed.error.issues,
    });
  }
  try {
    const updated = await updateUserNotificationPrefs(userId, parsed.data);
    return res.json({ success: true, data: { prefs: updated } });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Bildirim tercihleri güncelleme hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Tercihler güncellenemedi.' });
  }
};

/**
 * GET /api/notifications/stream?token=<jwt>
 *
 * Server-Sent Events bağlantısı.
 * EventSource Authorization header'ını desteklemediği için
 * token query string'den alınır ve burada doğrulanır.
 */
export const streamNotifications = (req: Request, res: Response) => {
  const token = (req.query.token as string) || '';
  if (!token) {
    return res.status(401).end();
  }

  let userId: string;
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { id?: string; userId?: string };
    userId = payload.id || payload.userId || '';
    if (!userId) throw new Error('Token kullanıcı kimliği içermiyor.');
  } catch (err) {
    logger.warn(`SSE token doğrulanamadı: ${(err as Error).message}`);
    return res.status(401).end();
  }

  // SSE header'ları
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx tampon kapat
  });
  // Bazı proxy'ler 200 yanıtı flush etmeden bekleyebilir; hemen flush
  res.flushHeaders?.();

  const cleanup = registerClient(userId, res);
  req.on('close', cleanup);

  // Yanıt geri dönmüyor; stream kapanana kadar canlı.
  return undefined;
};
