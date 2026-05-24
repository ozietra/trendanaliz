'use client';

import React, { useEffect, useState } from 'react';
import AdminSidebar from '../../../components/AdminSidebar';
import { api } from '../../../lib/api';
import { Loader2, Plus, Edit2, Trash2, X, Save } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  maxProducts: number;
  maxCompetitors: number;
  refreshInterval: number;
  features: string[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  _count?: { subscriptions: number };
}

const emptyForm: Partial<Plan> = {
  name: '',
  slug: '',
  description: '',
  price: '0',
  currency: 'TRY',
  billingCycle: 'MONTHLY',
  maxProducts: 100,
  maxCompetitors: 5,
  refreshInterval: 60,
  features: [],
  isActive: true,
  isPopular: false,
  sortOrder: 0,
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/plans');
      setPlans(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...editing,
        price: Number(editing.price),
        maxProducts: Number(editing.maxProducts),
        maxCompetitors: Number(editing.maxCompetitors),
        refreshInterval: Number(editing.refreshInterval),
        sortOrder: Number(editing.sortOrder),
      };
      if (editing.id) {
        await api.put(`/admin/plans/${editing.id}`, payload);
      } else {
        await api.post('/admin/plans', payload);
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kayıt başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Plan) => {
    if (!confirm(`"${p.name}" planını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/admin/plans/${p.id}`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Silinemedi.');
    }
  };

  return (
    <>
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
              Süperadmin
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Planlar</h1>
          </div>
          <button
            onClick={() => setEditing({ ...emptyForm })}
            className="px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-xs inline-flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Yeni Plan
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
            <span className="text-xs text-slate-400">Yükleniyor...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`bg-[#0b1424] border rounded-2xl p-5 ${
                  p.isPopular ? 'border-brand-orange/40' : 'border-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-black text-white">{p.name}</h3>
                  {p.isPopular && (
                    <span className="text-[9px] font-bold uppercase bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded">
                      Popüler
                    </span>
                  )}
                  {!p.isActive && (
                    <span className="text-[9px] font-bold uppercase bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">
                      Pasif
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mb-2">{p.slug}</div>
                <div className="text-2xl font-black text-white mb-3">
                  ₺{Number(p.price).toLocaleString('tr-TR')}
                  <span className="text-xs text-slate-500 ml-1">
                    / {p.billingCycle === 'YEARLY' ? 'yıl' : 'ay'}
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-400 mb-4">
                  <div>Maks. Ürün: <span className="text-white font-bold">{p.maxProducts}</span></div>
                  <div>Maks. Rakip: <span className="text-white font-bold">{p.maxCompetitors}</span></div>
                  <div>Yenileme: <span className="text-white font-bold">{p.refreshInterval}dk</span></div>
                  <div>Abone Sayısı: <span className="text-white font-bold">{p._count?.subscriptions ?? 0}</span></div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
                  >
                    <Edit2 className="w-3 h-3" />
                    Düzenle
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await api.put(`/admin/plans/${p.id}`, { isActive: !p.isActive });
                        await load();
                      } catch (err: any) {
                        setError(err.response?.data?.message || 'Güncellenemedi.');
                      }
                    }}
                    className={`px-3 py-2 rounded-lg font-bold text-xs border ${p.isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'}`}
                    title={p.isActive ? 'Satışa Kapat' : 'Satışa Aç'}
                  >
                    {p.isActive ? '✓ Satışta' : '✕ Kapalı'}
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-[#0b1424] border border-white/[0.06] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-white">
                  {editing.id ? 'Planı Düzenle' : 'Yeni Plan'}
                </h2>
                <button
                  onClick={() => setEditing(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Ad"
                  value={editing.name || ''}
                  onChange={(v) => setEditing({ ...editing, name: v })}
                />
                <Field
                  label="Slug"
                  value={editing.slug || ''}
                  onChange={(v) => setEditing({ ...editing, slug: v })}
                />
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Açıklama
                  </label>
                  <textarea
                    value={editing.description || ''}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    rows={2}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <Field
                  label="Fiyat (₺)"
                  type="number"
                  value={String(editing.price ?? '')}
                  onChange={(v) => setEditing({ ...editing, price: v })}
                />
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Faturalama
                  </label>
                  <select
                    value={editing.billingCycle}
                    onChange={(e) =>
                      setEditing({ ...editing, billingCycle: e.target.value as any })
                    }
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="MONTHLY">Aylık</option>
                    <option value="YEARLY">Yıllık</option>
                  </select>
                </div>
                <Field
                  label="Maks. Ürün"
                  type="number"
                  value={String(editing.maxProducts ?? 0)}
                  onChange={(v) => setEditing({ ...editing, maxProducts: Number(v) })}
                />
                <Field
                  label="Maks. Rakip"
                  type="number"
                  value={String(editing.maxCompetitors ?? 0)}
                  onChange={(v) => setEditing({ ...editing, maxCompetitors: Number(v) })}
                />
                <Field
                  label="Yenileme (dk)"
                  type="number"
                  value={String(editing.refreshInterval ?? 60)}
                  onChange={(v) => setEditing({ ...editing, refreshInterval: Number(v) })}
                />
                <Field
                  label="Sıralama"
                  type="number"
                  value={String(editing.sortOrder ?? 0)}
                  onChange={(v) => setEditing({ ...editing, sortOrder: Number(v) })}
                />
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Özellikler (satır başına bir tane)
                  </label>
                  <textarea
                    value={(editing.features || []).join('\n')}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        features: e.target.value.split('\n').filter((s) => s.trim()),
                      })
                    }
                    rows={5}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.isActive ?? true}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                    className="accent-brand-orange"
                  />
                  Aktif
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.isPopular ?? false}
                    onChange={(e) => setEditing({ ...editing, isPopular: e.target.checked })}
                    className="accent-brand-orange"
                  />
                  En Popüler Rozeti
                </label>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
                >
                  İptal
                </button>
                <button
                  onClick={save}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-xs inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-brand-orange/40 outline-none rounded-lg px-3 py-2 text-xs text-white"
      />
    </div>
  );
}
