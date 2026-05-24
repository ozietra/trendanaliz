'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import { Loader2, Plus, Trash2, Percent, Edit2, Check, X, Info } from 'lucide-react';

interface Commission {
  id: string;
  categoryName: string;
  rate: string;
  updatedAt: string;
}

export default function KomisyonPage() {
  const [items, setItems] = useState<Commission[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Inline add
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newRate, setNewRate] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, catRes] = await Promise.all([
        api.get('/commissions'),
        api.get('/products/categories').catch(() => ({ data: { data: [] } })),
      ]);
      setItems(cRes.data?.data || []);
      setCategories(catRes.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!newCat.trim() || !newRate) return;
    setSaveBusy(true);
    setError(null);
    try {
      await api.post('/commissions', { categoryName: newCat.trim(), rate: Number(newRate) });
      setSuccess('Komisyon kaydedildi.');
      setAdding(false);
      setNewCat('');
      setNewRate('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kaydedilemedi.');
    } finally {
      setSaveBusy(false);
    }
  };

  const updateRate = async (id: string) => {
    if (!editRate) return;
    try {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      await api.post('/commissions', { categoryName: item.categoryName, rate: Number(editRate) });
      setEditId(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Güncellenemedi.');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Bu komisyon kaydını silmek istiyor musunuz?')) return;
    try {
      await api.delete(`/commissions/${id}`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Silinemedi.');
    }
  };

  const existingCats = new Set(items.map((i) => i.categoryName));
  const availableCats = categories.filter((c) => !existingCats.has(c));

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Fiyat Yönetimi</div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Komisyon Oranları</h1>
          </div>
          <button
            onClick={() => { setAdding(true); setError(null); setSuccess(null); }}
            disabled={adding}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-bold transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Komisyon Ekle
          </button>
        </div>

        {/* Bilgilendirme */}
        <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 mb-4">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-300/80">
            Trendyol API&apos;sinde komisyon oranlarını çeken bir endpoint bulunmadığından, oranları <a href="https://akademi.trendyol.com/satici-bilgi-merkezi/detay/trendyol-komisyonlari" target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">Trendyol Akademi</a>&apos;den kontrol edip buraya girebilirsiniz.
            Haftalık komisyon değişikliklerinde bu tabloyu güncelleyerek toplu fiyatlandırma hesaplamalarınızda kullanabilirsiniz.
          </div>
        </div>

        {error && <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">{error}</div>}
        {success && <div className="text-emerald-300 text-xs bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 mb-4">{success}</div>}

        <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
              <span className="text-xs text-slate-400">Yükleniyor...</span>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.04] text-slate-500">
                  <th className="text-left p-3 font-semibold">Kategori</th>
                  <th className="text-right p-3 font-semibold">Komisyon Oranı</th>
                  <th className="text-right p-3 font-semibold hidden md:table-cell">Son Güncelleme</th>
                  <th className="text-right p-3 font-semibold w-24">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {/* Inline add row */}
                {adding && (
                  <tr className="border-b border-brand-orange/20 bg-brand-orange/5">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <input
                          list="cat-options"
                          value={newCat}
                          onChange={(e) => setNewCat(e.target.value)}
                          placeholder="Kategori adı..."
                          className="flex-1 px-3 py-1.5 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40"
                        />
                        <datalist id="cat-options">
                          {availableCats.map((c) => <option key={c} value={c} />)}
                        </datalist>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number" min={0} max={100} step={0.5}
                          value={newRate}
                          onChange={(e) => setNewRate(e.target.value)}
                          placeholder="0.0"
                          className="w-20 px-2 py-1.5 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40 text-right"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell"></td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={save} disabled={saveBusy || !newCat.trim() || !newRate} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 disabled:opacity-30">
                          {saveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setAdding(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {items.length === 0 && !adding ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-sm text-slate-500">
                      <Percent className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      Henüz komisyon oranı girilmemiş.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                      <td className="p-3 text-white font-medium">{item.categoryName}</td>
                      <td className="p-3 text-right">
                        {editId === item.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number" min={0} max={100} step={0.5}
                              value={editRate}
                              onChange={(e) => setEditRate(e.target.value)}
                              className="w-20 px-2 py-1.5 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40 text-right"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && updateRate(item.id)}
                            />
                            <span className="text-slate-400">%</span>
                            <button onClick={() => updateRate(item.id)} className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setEditId(null)} className="p-1 rounded hover:bg-white/5 text-slate-400"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <span className="text-white font-bold">%{Number(item.rate).toFixed(1)}</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-500 hidden md:table-cell text-[10px]">
                        {new Date(item.updatedAt).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => { setEditId(item.id); setEditRate(String(Number(item.rate))); }}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition"
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => remove(item.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
