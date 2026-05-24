'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminSidebar from '../../../components/AdminSidebar';
import { api } from '../../../lib/api';
import { Loader2, CheckCircle2, XCircle, Eye } from 'lucide-react';

interface Payment {
  id: string;
  amount: string;
  currency: string;
  provider: string;
  method: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  ibanSenderName: string | null;
  ibanNote: string | null;
  receiptUrl: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string };
  subscription: { plan: { name: string; slug: string } } | null;
}

interface PlanLite {
  id: string;
  name: string;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
  REFUNDED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

function PaymentsInner() {
  const search = useSearchParams();
  const initialStatus = search.get('status') || '';

  const [items, setItems] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [verifyPayment, setVerifyPayment] = useState<Payment | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/payments', {
        params: { status: status || undefined, page, pageSize: 25 },
      });
      setItems(res.data?.data || []);
      setPages(res.data?.pagination?.pages || 1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const res = await api.get('/admin/plans');
      setPlans((res.data?.data || []).map((p: any) => ({ id: p.id, name: p.name })));
    })();
  }, []);

  const doVerify = async () => {
    if (!verifyPayment) return;
    setBusy(true);
    try {
      await api.post(`/admin/payments/${verifyPayment.id}/verify`, {
        activatePlanId: selectedPlanId || undefined,
      });
      setVerifyPayment(null);
      setSelectedPlanId('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Onay başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const doReject = async (p: Payment) => {
    const reason = prompt('Ret nedeni (kullanıcıya bildirim olarak iletilir):');
    if (reason === null) return;
    try {
      await api.post(`/admin/payments/${p.id}/reject`, { reason });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ret başarısız.');
    }
  };

  return (
    <>
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
            Süperadmin
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Ödemeler</h1>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {['', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                status === s
                  ? 'bg-brand-orange text-white'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {s || 'Tümü'}
            </button>
          ))}
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
            <div className="text-center py-12 text-sm text-slate-400">Kayıt bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-white/[0.04]">
                    <th className="text-left p-3 font-semibold">Tarih</th>
                    <th className="text-left p-3 font-semibold">Kullanıcı</th>
                    <th className="text-right p-3 font-semibold">Tutar</th>
                    <th className="text-left p-3 font-semibold hidden md:table-cell">Sağlayıcı</th>
                    <th className="text-center p-3 font-semibold">Durum</th>
                    <th className="text-right p-3 font-semibold">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.02]">
                      <td className="p-3 text-slate-300 text-[10px]">
                        {new Date(p.createdAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="p-3">
                        <div className="text-white font-semibold">{p.user.name}</div>
                        <div className="text-[10px] text-slate-500">{p.user.email}</div>
                      </td>
                      <td className="p-3 text-right text-white font-bold">
                        ₺{Number(p.amount).toLocaleString('tr-TR')}
                      </td>
                      <td className="p-3 hidden md:table-cell text-slate-300 text-[10px] font-mono">
                        {p.provider}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                            STATUS_STYLE[p.status]
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {p.status === 'PENDING' ? (
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => setVerifyPayment(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] font-bold"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Onayla
                            </button>
                            <button
                              onClick={() => doReject(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-[10px] font-bold"
                            >
                              <XCircle className="w-3 h-3" /> Reddet
                            </button>
                          </div>
                        ) : (
                          p.receiptUrl && (
                            <a
                              href={p.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-slate-300 text-[10px] font-bold"
                            >
                              <Eye className="w-3 h-3" /> Dekont
                            </a>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

        {/* Verify modal */}
        {verifyPayment && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-[#0b1424] border border-white/[0.06] rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-lg font-black text-white mb-3">Ödemeyi Onayla</h2>
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 mb-4 text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Kullanıcı:</span>{' '}
                  <span className="text-white font-bold">{verifyPayment.user.name}</span>{' '}
                  <span className="text-slate-500">({verifyPayment.user.email})</span>
                </div>
                <div>
                  <span className="text-slate-500">Tutar:</span>{' '}
                  <span className="text-white font-bold">
                    ₺{Number(verifyPayment.amount).toLocaleString('tr-TR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Yöntem:</span>{' '}
                  <span className="text-white font-mono">{verifyPayment.provider}</span>
                </div>
                {verifyPayment.ibanSenderName && (
                  <div>
                    <span className="text-slate-500">Gönderici:</span>{' '}
                    <span className="text-white">{verifyPayment.ibanSenderName}</span>
                  </div>
                )}
                {verifyPayment.ibanNote && (
                  <div>
                    <span className="text-slate-500">Açıklama:</span>{' '}
                    <span className="text-white">{verifyPayment.ibanNote}</span>
                  </div>
                )}
              </div>

              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Aktive Edilecek Plan (opsiyonel)
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white mb-4"
              >
                <option value="">Sadece ödemeyi tamamlandı olarak işaretle</option>
                {plans.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mb-4">
                Plan seçilirse, mevcut aktif abonelik sonlandırılıp seçilen plan başlatılır.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setVerifyPayment(null);
                    setSelectedPlanId('');
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
                >
                  İptal
                </button>
                <button
                  onClick={doVerify}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Onayla
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function AdminPaymentsPage() {
  return (
    <Suspense
      fallback={
        <>
          <AdminSidebar />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
          </main>
        </>
      }
    >
      <PaymentsInner />
    </Suspense>
  );
}
