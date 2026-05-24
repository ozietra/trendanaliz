'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api';
import { useAuthStore } from '../store/auth.store';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  isRead: boolean;
  createdAt: string;
  /** Bildirime tıklayınca gidilecek ilgili sayfa (örn /dashboard/siparisler/<id>) */
  linkUrl?: string | null;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Bildirimleri yükleyen + SSE üzerinden anlık güncelleyen hook.
 *
 * - İlk yüklemede son 50 bildirimi REST üzerinden çeker.
 * - Ardından `/notifications/stream?token=...` SSE bağlantısı kurar.
 * - Yeni bir `notification` event'i geldiğinde listenin başına ekler.
 * - Bağlantı kopması halinde 5 saniyede bir yeniden dener.
 */
export function useNotifications() {
  const { accessToken: token, isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setItems(res.data?.data || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch {
      /* sessizce yoksay */
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      /* yoksay - UI güncellenmiş */
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await api.post('/notifications/read-all');
    } catch {
      /* yoksay */
    }
  }, []);

  // SSE bağlantısı (token varlığına bağlı)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    fetchAll();

    const connect = () => {
      try {
        const url = `${API_BASE}/notifications/stream?token=${encodeURIComponent(token)}`;
        const es = new EventSource(url);
        esRef.current = es;

        es.addEventListener('connected', () => setConnected(true));

        es.addEventListener('notification', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as Notification;
            setItems((prev) => [data, ...prev].slice(0, 50));
            setUnreadCount((c) => c + 1);
          } catch {
            /* parse hatası */
          }
        });

        es.onerror = () => {
          setConnected(false);
          es.close();
          if (retryRef.current) clearTimeout(retryRef.current);
          retryRef.current = setTimeout(connect, 5000);
        };
      } catch {
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [isAuthenticated, token, fetchAll]);

  return {
    items,
    unreadCount,
    loading,
    connected,
    refresh: fetchAll,
    markAsRead,
    markAllAsRead,
  };
}
