'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import { Loader2, ArrowUpDown, Eye, Rocket, ChevronDown, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  color: string;
  items: Array<{ product: { id: string } }>;
}

interface PreviewItem {
  id: string;
  title: string;
  barcode: string;
  categoryName: string | null;
  currentSalePrice: number;
  newSalePrice: number;
  currentListPrice: number;
  newListPrice: number;
}

type ScopeType = 'group' | 'category' | 'all';
type FormulaType = 'PERCENT_CHANGE' | 'FIXED_CHANGE' | 'SET_PRICE';
type Direction = 'increase' | 'decrease';
type ApplyTo = 'salePrice' | 'listPrice' | 'both';

export default function TopluFiyatPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [scopeType, setScopeType] = useState<ScopeType>('category');
  const [groupId, setGroupId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [formulaType, setFormulaType] = useState<FormulaType>('PERCENT_CHANGE');
  const [formulaValue, setFormulaValue] = useState(5);
  const [direction, setDirection] = useState<Direction>('increase');
  const [applyTo, setApplyTo] = useState<ApplyTo>('both');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  // Preview
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, cRes] = await Promise.all([
        api.get('/product-groups').catch(() => ({ data: { data: [] } })),
        api.get('/products/categories').catch(() => ({ data: { data: [] } })),
      ]);
      setGroups(gRes.data?.data || []);
      setCategories(cRes.data?.data || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const buildBody = () => ({
    scope: {
      type: scopeType,
      ...(scopeType === 'group' ? { groupId } : {}),
      ...(scopeType === 'category' ? { categoryName } : {}),
    },
    formula: {
      type: formulaType,
      value: formulaValue,
      ...(formulaType !== 'SET_PRICE' ? { direction } : {}),
      applyTo,
    },
    constraints: {
      ...(minPrice !== '' ? { minPrice: Number(minPrice) } : {}),
      ...(maxPrice !== '' ? { maxPrice: Number(maxPrice) } : {}),
    },
  });

  const runPreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await api.post('/bulk-pricing/preview', buildBody());
      setPreview(res.data?.data?.items || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Önizleme başarısız.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const runApply = async () => {
    if (!confirm(`${preview?.length || 0} ürünün fiyatını güncellemek istediğinize emin misiniz?`)) return;
    setApplyLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post('/bulk-pricing/apply', buildBody());
      setSuccess(res.data?.message || 'Fiyatlar güncellendi.');
      setPreview(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Uygulama başarısız.');
    } finally {
      setApplyLoading(false);
    }
  };

  const isScopeValid = scopeType === 'all' || (scopeType === 'group' && groupId) || (scopeType === 'category' && categoryName);

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Fiyat Yönetimi</div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Toplu Fiyatlandırma</h1>
          <p className="text-xs text-slate-400 mt-1">Grup veya kategoriye göre toplu fiyat değişikliği yapın.</p>
        </div>

        {error && <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">{error}</div>}
        {success && <div className="text-emerald-300 text-xs bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 mb-4">{success}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
            <span className="text-xs text-slate-400">Yükleniyor...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Sol Panel: Konfigürasyon */}
            <div className="xl:col-span-1 space-y-4">
              {/* Kapsam */}
              <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">1. Kapsam Seçin</h3>
                <div className="flex gap-1 mb-3">
                  {([['category', 'Kategori'], ['group', 'Grup'], ['all', 'Tümü']] as [ScopeType, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => setScopeType(val)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition ${scopeType === val ? 'bg-brand-orange text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {scopeType === 'category' && (
                  <div className="relative">
                    <select value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40 appearance-none">
                      <option value="">Kategori seçin...</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
                {scopeType === 'group' && (
                  <div className="relative">
                    <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40 appearance-none">
                      <option value="">Grup seçin...</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.items.length} ürün)</option>)}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Formül */}
              <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">2. Fiyat Formülü</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <select value={formulaType} onChange={(e) => setFormulaType(e.target.value as FormulaType)} className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40 appearance-none">
                      <option value="PERCENT_CHANGE">Yüzde Değişiklik (%)</option>
                      <option value="FIXED_CHANGE">Sabit Tutar (₺)</option>
                      <option value="SET_PRICE">Sabit Fiyat Ata</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {formulaType !== 'SET_PRICE' && (
                    <div className="flex gap-1">
                      <button onClick={() => setDirection('increase')} className={`flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition ${direction === 'increase' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-transparent'}`}>
                        <TrendingUp className="w-3 h-3" /> Artır
                      </button>
                      <button onClick={() => setDirection('decrease')} className={`flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition ${direction === 'decrease' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-transparent'}`}>
                        <TrendingDown className="w-3 h-3" /> Azalt
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      {formulaType === 'PERCENT_CHANGE' ? 'Yüzde (%)' : formulaType === 'FIXED_CHANGE' ? 'Tutar (₺)' : 'Sabit Fiyat (₺)'}
                    </label>
                    <input type="number" min={0} step={formulaType === 'PERCENT_CHANGE' ? 0.5 : 1} value={formulaValue} onChange={(e) => setFormulaValue(Number(e.target.value))} className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40" />
                  </div>

                  <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Uygulama Hedefi</label>
                    <select value={applyTo} onChange={(e) => setApplyTo(e.target.value as ApplyTo)} className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40 appearance-none">
                      <option value="both">Satış + Liste Fiyatı</option>
                      <option value="salePrice">Sadece Satış Fiyatı</option>
                      <option value="listPrice">Sadece Liste Fiyatı</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Kısıtlamalar */}
              <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">3. Fiyat Sınırları (Opsiyonel)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Min Fiyat (₺)</label>
                    <input type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : '')} placeholder="—" className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Max Fiyat (₺)</label>
                    <input type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')} placeholder="—" className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40" />
                  </div>
                </div>
              </div>

              {/* Aksiyon Butonları */}
              <div className="flex gap-2">
                <button onClick={runPreview} disabled={previewLoading || !isScopeValid || formulaValue <= 0} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold disabled:opacity-40 transition">
                  {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Önizle
                </button>
                <button onClick={runApply} disabled={applyLoading || !preview || preview.length === 0} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-bold disabled:opacity-40 transition">
                  {applyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />} Uygula
                </button>
              </div>
            </div>

            {/* Sağ Panel: Önizleme */}
            <div className="xl:col-span-2">
              <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden h-full">
                <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-brand-orange" /> Fiyat Değişikliği Önizlemesi
                  </h3>
                  {preview && <span className="text-[10px] text-slate-400">{preview.length} ürün etkilenecek</span>}
                </div>
                {!preview ? (
                  <div className="flex items-center justify-center py-20 text-xs text-slate-500">
                    Değişiklikleri görmek için &quot;Önizle&quot; butonuna tıklayın.
                  </div>
                ) : preview.length === 0 ? (
                  <div className="flex items-center justify-center py-20 text-xs text-slate-500">
                    Seçili kapsamda etkilenen ürün yok.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#0b1424]">
                        <tr className="border-b border-white/[0.04] text-slate-500">
                          <th className="text-left p-3 font-semibold">Ürün</th>
                          <th className="text-right p-3 font-semibold">Eski Satış</th>
                          <th className="text-center p-3 font-semibold w-8"></th>
                          <th className="text-right p-3 font-semibold">Yeni Satış</th>
                          <th className="text-right p-3 font-semibold hidden md:table-cell">Eski Liste</th>
                          <th className="text-center p-3 font-semibold hidden md:table-cell w-8"></th>
                          <th className="text-right p-3 font-semibold hidden md:table-cell">Yeni Liste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((item) => {
                          const saleDiff = item.newSalePrice - item.currentSalePrice;
                          return (
                            <tr key={item.id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                              <td className="p-3">
                                <div className="text-white truncate max-w-xs">{item.title}</div>
                                <div className="text-[10px] text-slate-500">{item.barcode}</div>
                              </td>
                              <td className="p-3 text-right text-slate-400">₺{item.currentSalePrice.toFixed(2)}</td>
                              <td className="p-3 text-center"><ArrowRight className="w-3 h-3 text-slate-500 inline" /></td>
                              <td className="p-3 text-right font-bold">
                                <span className={saleDiff > 0 ? 'text-emerald-400' : saleDiff < 0 ? 'text-red-400' : 'text-white'}>
                                  ₺{item.newSalePrice.toFixed(2)}
                                </span>
                                {saleDiff !== 0 && (
                                  <div className={`text-[9px] ${saleDiff > 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                                    {saleDiff > 0 ? '+' : ''}{saleDiff.toFixed(2)}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-right text-slate-400 hidden md:table-cell">₺{item.currentListPrice.toFixed(2)}</td>
                              <td className="p-3 text-center hidden md:table-cell"><ArrowRight className="w-3 h-3 text-slate-500 inline" /></td>
                              <td className="p-3 text-right font-bold hidden md:table-cell text-white">₺{item.newListPrice.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
