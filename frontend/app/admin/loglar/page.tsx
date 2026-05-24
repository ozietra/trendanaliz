'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AdminSidebar from '../../../components/AdminSidebar';
import { api } from '../../../lib/api';
import { Loader2, ScrollText } from 'lucide-react';

interface Log {
  id: string;
  action: string;
  target: string;
  detail: any;
  createdAt: string;
  admin: { email: string; name: string };
}

const ACTION_STYLE: Record<string, string> = {
  USER_UPDATE: 'bg-blue-500/10 text-blue-400',
  PLAN_CREATE: 'bg-emerald-500/10 text-emerald-400',
  PLAN_UPDATE: 'bg-amber-500/10 text-amber-400',
  PLAN_DELETE: 'bg-red-500/10 text-red-400',
  PAYMENT_VERIFY: 'bg-emerald-500/10 text-emerald-400',
  PAYMENT_REJECT: 'bg-red-500/10 text-red-400',
  SETTING_UPDATE: 'bg-purple-500/10 text-purple-400',
};

export default function AdminLogsPage() {
  const [items, setItems] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/logs', { params: { page, pageSize: 50 } });
      setItems(res.data?.data || []);
      setPages(res.data?.pagination?.pages || 1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
            Süperadmin
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Admin Eylem Logları
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Süperadminlerin yaptığı tüm değişiklikler burada loglanır.
          </p>
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
              <span className="text-xs text-slate-400">Yükleniyor...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Henüz log kaydı yok.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {items.map((l) => (
                <li key={l.id} className="p-3 hover:bg-white/[0.01] cursor-pointer"
                  onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                        ACTION_STYLE[l.action] || 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {l.action}
                    </span>
                    <span className="text-xs text-white">
                      <strong>{l.admin.name}</strong>{' '}
                      <span className="text-slate-500">({l.admin.email})</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono ml-auto">
                      target: {l.target}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(l.createdAt).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  {expanded === l.id && l.detail && (
                    <pre className="mt-2 text-[10px] text-slate-300 bg-black/30 rounded-lg p-2 overflow-x-auto font-mono">
                      {JSON.stringify(l.detail, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 disabled:opacity-30 text-xs font-bold text-white"
            >
              Önceki
            </button>
            <span className="text-xs text-slate-400">
              {page} / {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="px-3 py-1.5 rounded-lg bg-white/5 disabled:opacity-30 text-xs font-bold text-white"
            >
              Sonraki
            </button>
          </div>
        )}
      </main>
    </>
  );
}
