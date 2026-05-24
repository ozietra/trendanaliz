'use client';

import React, { useEffect, useState } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import { Loader2, Bell, CheckCheck, Settings, ChevronDown, Save } from 'lucide-react';
import NotificationPreferences from '../../../components/NotificationPreferences';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_STYLE: Record<string, string> = {
  WARNING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ERROR: 'bg-red-500/10 text-red-400 border-red-500/20',
  SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  INFO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function BildirimlerPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setItems(res.data?.data || []);
      setUnread(res.data?.unreadCount || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Bildirimler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markOne = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      await load();
    } catch (err) {
      // sessizce yut
    }
  };

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'İşlem başarısız.');
    }
  };

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
              Sistem
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Bildirimler
              {unread > 0 && (
                <span className="text-[10px] font-bold bg-brand-orange text-white rounded-full px-2 py-0.5">
                  {unread} yeni
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrefsOpen((v) => !v)}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs flex items-center gap-2"
            >
              <Settings className="w-3.5 h-3.5" />
              Tercihler
              <ChevronDown className={`w-3 h-3 transition-transform ${prefsOpen ? 'rotate-180' : ''}`} />
            </button>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs flex items-center gap-2"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tümünü Okundu İşaretle
              </button>
            )}
          </div>
        </div>

        {prefsOpen && (
          <div className="mb-4">
            <NotificationPreferences />
          </div>
        )}

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
              <span className="text-xs text-slate-400">Yükleniyor...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-semibold">Henüz bildirim yok.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`p-4 flex gap-3 items-start cursor-pointer hover:bg-white/[0.02] ${
                    !n.isRead ? 'bg-brand-orange/[0.02]' : ''
                  }`}
                  onClick={() => !n.isRead && markOne(n.id)}
                >
                  <div className="mt-1">
                    {!n.isRead && (
                      <span className="block w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{n.title}</span>
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                          TYPE_STYLE[n.type] || TYPE_STYLE.INFO
                        }`}
                      >
                        {n.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-slate-500 mt-2 block">
                      {new Date(n.createdAt).toLocaleString('tr-TR')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
