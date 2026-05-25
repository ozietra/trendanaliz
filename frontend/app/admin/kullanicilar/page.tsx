'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AdminSidebar from '../../../components/AdminSidebar';
import { api } from '../../../lib/api';
import { Loader2, Search, ShieldCheck, ShieldOff, CheckCircle2, XCircle, Gift, Ban, X, Trash2, AlertTriangle } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  deletionRequestedAt: string | null;
  subscriptions: Array<{ status: string; endDate: string; plan: { name: string } }>;
  stores: Array<{ id: string; storeName: string; isActive: boolean; productCount: number; buyboxEligible: number }>;
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Demo modal state
  const [demoTarget, setDemoTarget] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [demoPlanId, setDemoPlanId] = useState('');
  const [demoDays, setDemoDays] = useState(7);
  const [demoBusy, setDemoBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { q, page, pageSize: 25 } });
      setItems(res.data?.data || []);
      setPages(res.data?.pagination?.pages || 1);
      setTotal(res.data?.pagination?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Plan listesini bir kez yükle (demo modalında dropdown için)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/admin/plans');
        const list: Plan[] = (res.data?.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
        }));
        setPlans(list);
        if (list[0]) setDemoPlanId(list[0].id);
      } catch (err: any) {
        // Sessiz — kullanıcı sayfası planlarsız da çalışır
      }
    })();
  }, []);

  const openDemoModal = (u: User) => {
    setDemoTarget(u);
    setDemoDays(7);
    setError(null);
    setSuccess(null);
  };

  const grantDemo = async () => {
    if (!demoTarget || !demoPlanId || demoDays < 1) return;
    setDemoBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post(`/admin/users/${demoTarget.id}/grant-trial`, {
        planId: demoPlanId,
        days: demoDays,
      });
      setSuccess(res.data?.message || 'Demo aboneliği tanımlandı.');
      setDemoTarget(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Demo verme başarısız.');
    } finally {
      setDemoBusy(false);
    }
  };

  const cancelSubscription = async (u: User) => {
    if (!u.subscriptions[0]) {
      setError('Bu kullanıcının aktif aboneliği yok.');
      return;
    }
    const reason = prompt(
      `${u.email} kullanıcısının aboneliğini iptal etmek istediğinize emin misiniz?\n\nİptal nedeni (opsiyonel):`,
      ''
    );
    if (reason === null) return;
    try {
      const res = await api.post(`/admin/users/${u.id}/cancel-subscription`, {
        reason: reason || undefined,
      });
      setSuccess(res.data?.message || 'Abonelik iptal edildi.');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'İptal başarısız.');
    }
  };

  const toggleActive = async (u: User) => {
    if (!confirm(`${u.email} hesabını ${u.isActive ? 'devre dışı bırakmak' : 'aktive etmek'} istiyor musunuz?`))
      return;
    try {
      await api.patch(`/admin/users/${u.id}`, { isActive: !u.isActive });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'İşlem başarısız.');
    }
  };

  const setRole = async (u: User, newRole: User['role']) => {
    if (u.role === newRole) return;
    if (!confirm(`${u.email} kullanıcısının rolünü ${newRole} yapmak istiyor musunuz?`)) return;
    try {
      await api.patch(`/admin/users/${u.id}`, { role: newRole });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'İşlem başarısız.');
    }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`⚠️ DİKKAT: ${u.email} hesabını ve TÜM verilerini kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) return;
    try {
      const res = await api.delete(`/admin/users/${u.id}`);
      setSuccess(res.data?.message || 'Kullanıcı silindi.');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Silme başarısız.');
    }
  };

  const rejectDeletion = async (u: User) => {
    if (!confirm(`${u.email} kullanıcısının silme talebini reddetmek istiyor musunuz?`)) return;
    try {
      const res = await api.post(`/admin/users/${u.id}/reject-deletion`);
      setSuccess(res.data?.message || 'Silme talebi reddedildi.');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'İşlem başarısız.');
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
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Kullanıcılar
          </h1>
          <p className="text-xs text-slate-400 mt-1">Toplam {total} kayıt</p>
        </div>

        <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4 mb-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
              placeholder="E-posta veya isim ara..."
              className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-brand-orange/40 outline-none rounded-lg pl-10 pr-3 py-2 text-xs text-white placeholder-slate-600"
            />
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="text-emerald-300 text-xs bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 mb-4">
            {success}
          </div>
        )}

        <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
              <span className="text-xs text-slate-400">Yükleniyor...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">Sonuç bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-white/[0.04]">
                    <th className="text-left p-3 font-semibold">Kullanıcı</th>
                    <th className="text-left p-3 font-semibold hidden md:table-cell">Rol</th>
                    <th className="text-left p-3 font-semibold hidden lg:table-cell">Abonelik</th>
                    <th className="text-left p-3 font-semibold hidden lg:table-cell">Ürünler</th>
                    <th className="text-center p-3 font-semibold">Durum</th>
                    <th className="text-left p-3 font-semibold hidden md:table-cell">Kayıt</th>
                    <th className="text-right p-3 font-semibold">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                      <td className="p-3">
                        <div className="text-white font-semibold">{u.name}</div>
                        <div className="text-[10px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <select
                          value={u.role}
                          onChange={(e) => setRole(u, e.target.value as User['role'])}
                          disabled={u.role === 'SUPERADMIN'}
                          className="bg-white/[0.02] border border-white/[0.06] rounded px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPERADMIN">SUPERADMIN</option>
                        </select>
                      </td>
                      <td className="p-3 hidden lg:table-cell text-slate-300">
                        {u.subscriptions[0] ? (
                          <span className="text-[10px]">
                            <span className="font-bold text-white">{u.subscriptions[0].plan.name}</span>
                            <span className="text-slate-500 ml-1">({u.subscriptions[0].status})</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        {u.stores && u.stores.length > 0 ? (
                          <div className="space-y-0.5">
                            {u.stores.map((s) => (
                              <div key={s.id} className="text-[10px]">
                                <span className="text-white font-bold">{s.productCount}</span>
                                <span className="text-slate-500"> ürün</span>
                                {s.buyboxEligible > 0 && (
                                  <span className="text-brand-orange ml-1 font-bold">({s.buyboxEligible} BB)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {u.isActive ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 inline" />
                        )}
                      </td>
                      <td className="p-3 text-slate-400 hidden md:table-cell text-[10px]">
                        {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex flex-wrap gap-1 justify-end">
                          {/* Demo abonelik ver */}
                          <button
                            onClick={() => openDemoModal(u)}
                            disabled={u.role === 'SUPERADMIN'}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Demo abonelik tanımla"
                          >
                            <Gift className="w-3 h-3" /> Demo
                          </button>
                          {/* Aboneliği iptal et */}
                          <button
                            onClick={() => cancelSubscription(u)}
                            disabled={
                              u.role === 'SUPERADMIN' || !u.subscriptions[0]
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-orange-500/10 text-orange-300 border border-orange-500/20 hover:bg-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Aboneliği iptal et"
                          >
                            <Ban className="w-3 h-3" /> İptal
                          </button>
                          {/* Aktif/pasif */}
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={u.role === 'SUPERADMIN'}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                              u.isActive
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                          >
                            {u.isActive ? (
                              <>
                                <ShieldOff className="w-3 h-3" /> Devre Dışı
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3 h-3" /> Aktive Et
                              </>
                            )}
                          </button>
                          {/* Silme Talebi Varsa: Onayla / Reddet */}
                          {u.deletionRequestedAt && (
                            <>
                              <button
                                onClick={() => deleteUser(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 animate-pulse"
                                title="Silme talebini onayla (kalıcı sil)"
                              >
                                <Trash2 className="w-3 h-3" /> Sil (Onayla)
                              </button>
                              <button
                                onClick={() => rejectDeletion(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-500/10 text-slate-300 border border-slate-500/20 hover:bg-slate-500/20"
                                title="Silme talebini reddet"
                              >
                                <XCircle className="w-3 h-3" /> Reddet
                              </button>
                            </>
                          )}
                          {/* Silme talebi yoksa: Sil butonu */}
                          {!u.deletionRequestedAt && u.role !== 'SUPERADMIN' && (
                            <button
                              onClick={() => deleteUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                              title="Kullanıcıyı kalıcı sil"
                            >
                              <Trash2 className="w-3 h-3" /> Sil
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
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

      {/* Demo Abonelik Modalı */}
      {demoTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !demoBusy && setDemoTarget(null)}
        >
          <div
            className="w-full max-w-md bg-[#0b1424] border border-white/[0.06] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-300" />
                <h3 className="text-sm font-bold text-white">Demo Abonelik Tanımla</h3>
              </div>
              <button
                onClick={() => !demoBusy && setDemoTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="p-4 space-y-4">
              <div className="text-xs text-slate-300">
                <div className="font-bold text-white">{demoTarget.name}</div>
                <div className="text-slate-500">{demoTarget.email}</div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Plan
                </label>
                <select
                  value={demoPlanId}
                  onChange={(e) => setDemoPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40"
                >
                  {plans.length === 0 && <option value="">Plan yok</option>}
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Süre (gün, 1-90)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={demoDays}
                    onChange={(e) => setDemoDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
                    className="w-24 px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40"
                  />
                  {[1, 3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDemoDays(d)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                        demoDays === d
                          ? 'bg-brand-orange border-brand-orange text-white'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {d} gün
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Kullanıcının mevcut aktif/demo aboneliği varsa sonlandırılır ve bu yeni
                  demo aktive edilir.
                </p>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.04]">
              <button
                onClick={() => setDemoTarget(null)}
                disabled={demoBusy}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                onClick={grantDemo}
                disabled={demoBusy || !demoPlanId}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold disabled:opacity-50"
              >
                {demoBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Gift className="w-3.5 h-3.5" />
                )}
                Demo Tanımla
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
