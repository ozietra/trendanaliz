'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import { Loader2, Plus, FolderPlus, Trash2, X, Tag, ChevronDown, Check } from 'lucide-react';

interface ProductInGroup {
  id: string;
  title: string;
  barcode: string;
  salePrice: string;
  listPrice: string;
  categoryName: string | null;
  imageUrl: string | null;
}

interface Group {
  id: string;
  name: string;
  color: string;
  items: Array<{ id: string; product: ProductInGroup }>;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  price: number;
  categoryName: string | null;
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f59e0b'];

export default function UrunGruplariPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#f97316');
  const [creating, setCreating] = useState(false);

  // Add products modal
  const [addTarget, setAddTarget] = useState<Group | null>(null);
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [prodSearch, setProdSearch] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  // Auto-fill modal
  const [autoFillTarget, setAutoFillTarget] = useState<Group | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [autoFillBusy, setAutoFillBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/product-groups');
      setGroups(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gruplar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createGroup = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.post('/product-groups', { name: newName.trim(), color: newColor });
      setSuccess('Grup oluşturuldu.');
      setShowCreate(false);
      setNewName('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (g: Group) => {
    if (!confirm(`"${g.name}" grubunu silmek istiyor musunuz?`)) return;
    try {
      await api.delete(`/product-groups/${g.id}`);
      setSuccess('Grup silindi.');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Silinemedi.');
    }
  };

  const openAddProducts = async (g: Group) => {
    setAddTarget(g);
    setSelectedIds(new Set());
    setProdSearch('');
    try {
      const res = await api.get('/products');
      setAllProducts(res.data?.data || []);
    } catch { /* silent */ }
  };

  const addProductsToGroup = async () => {
    if (!addTarget || selectedIds.size === 0) return;
    setAddBusy(true);
    try {
      await api.post(`/product-groups/${addTarget.id}/products`, { productIds: Array.from(selectedIds) });
      setSuccess(`${selectedIds.size} ürün gruba eklendi.`);
      setAddTarget(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Eklenemedi.');
    } finally {
      setAddBusy(false);
    }
  };

  const removeProduct = async (groupId: string, productId: string) => {
    try {
      await api.delete(`/product-groups/${groupId}/products`, { data: { productIds: [productId] } });
      await load();
    } catch { /* silent */ }
  };

  const openAutoFill = async (g: Group) => {
    setAutoFillTarget(g);
    setSelectedCategory('');
    try {
      const res = await api.get('/products/categories');
      setCategories(res.data?.data || []);
    } catch { /* silent */ }
  };

  const autoFill = async () => {
    if (!autoFillTarget || !selectedCategory) return;
    setAutoFillBusy(true);
    try {
      const res = await api.post(`/product-groups/${autoFillTarget.id}/auto-fill`, { categoryName: selectedCategory });
      setSuccess(res.data?.message || 'Ürünler eklendi.');
      setAutoFillTarget(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Otomatik doldurma başarısız.');
    } finally {
      setAutoFillBusy(false);
    }
  };

  const existingIds = addTarget ? new Set(addTarget.items.map(i => i.product.id)) : new Set<string>();
  const filteredProducts = allProducts.filter(p =>
    !existingIds.has(p.id) &&
    (p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.sku.toLowerCase().includes(prodSearch.toLowerCase()))
  );

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Ürün Yönetimi</div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Ürün Grupları</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-bold transition"
          >
            <Plus className="w-4 h-4" /> Yeni Grup
          </button>
        </div>

        {error && <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">{error}</div>}
        {success && <div className="text-emerald-300 text-xs bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 mb-4">{success}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
            <span className="text-xs text-slate-400">Yükleniyor...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 bg-[#0b1424] border border-white/[0.04] rounded-xl">
            <FolderPlus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-semibold">Henüz ürün grubu yok.</p>
            <p className="text-xs text-slate-500 mt-1">Ürünlerinizi kategorilere göre gruplayarak toplu fiyatlandırma yapabilirsiniz.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {groups.map((g) => (
              <div key={g.id} className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden hover:border-white/[0.08] transition-all">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                    <h3 className="text-sm font-bold text-white">{g.name}</h3>
                    <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{g.items.length} ürün</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openAutoFill(g)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition" title="Kategoriye göre otomatik doldur">
                      <Tag className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openAddProducts(g)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition" title="Ürün ekle">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteGroup(g)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition" title="Grubu sil">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {g.items.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">Bu grupta henüz ürün yok.</div>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    {g.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2 border-b border-white/[0.02] hover:bg-white/[0.01] text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="text-white truncate">{item.product.title}</div>
                          <div className="text-[10px] text-slate-500">{item.product.barcode} {item.product.categoryName && `• ${item.product.categoryName}`}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-white font-bold">₺{Number(item.product.salePrice).toFixed(2)}</span>
                          <button onClick={() => removeProduct(g.id, item.product.id)} className="text-slate-500 hover:text-red-400 transition">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Yeni Grup Modalı */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !creating && setShowCreate(false)}>
          <div className="w-full max-w-md bg-[#0b1424] border border-white/[0.06] rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
              <h3 className="text-sm font-bold text-white">Yeni Ürün Grubu</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </header>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Grup Adı</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Örn: Elektronik" className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Renk</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)} className={`w-7 h-7 rounded-full border-2 transition ${newColor === c ? 'border-white scale-110' : 'border-transparent hover:border-white/30'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.04]">
              <button onClick={() => setShowCreate(false)} disabled={creating} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">Vazgeç</button>
              <button onClick={createGroup} disabled={creating || !newName.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-bold disabled:opacity-50">
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Oluştur
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Ürün Ekleme Modalı */}
      {addTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !addBusy && setAddTarget(null)}>
          <div className="w-full max-w-2xl bg-[#0b1424] border border-white/[0.06] rounded-xl shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white">Ürün Ekle → {addTarget.name}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{selectedIds.size} ürün seçildi</p>
              </div>
              <button onClick={() => setAddTarget(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </header>
            <div className="px-4 py-2 border-b border-white/[0.04] shrink-0">
              <input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Ürün adı veya barkod ara..." className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">Eklenecek ürün bulunamadı.</div>
              ) : (
                filteredProducts.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.02] hover:bg-white/[0.01] cursor-pointer text-xs">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${selectedIds.has(p.id) ? 'bg-brand-orange border-brand-orange' : 'border-white/20'}`}>
                      {selectedIds.has(p.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={selectedIds.has(p.id)} onChange={() => {
                      const next = new Set(selectedIds);
                      if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                      setSelectedIds(next);
                    }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-500">{p.sku} {p.categoryName && `• ${p.categoryName}`}</div>
                    </div>
                    <span className="text-white font-bold shrink-0">₺{p.price.toFixed(2)}</span>
                  </label>
                ))
              )}
            </div>
            <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.04] shrink-0">
              <button onClick={() => setAddTarget(null)} disabled={addBusy} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">Vazgeç</button>
              <button onClick={addProductsToGroup} disabled={addBusy || selectedIds.size === 0} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-bold disabled:opacity-50">
                {addBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {selectedIds.size} Ürün Ekle
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Otomatik Doldur Modalı */}
      {autoFillTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !autoFillBusy && setAutoFillTarget(null)}>
          <div className="w-full max-w-md bg-[#0b1424] border border-white/[0.06] rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
              <h3 className="text-sm font-bold text-white">Kategoriye Göre Otomatik Doldur</h3>
              <button onClick={() => setAutoFillTarget(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </header>
            <div className="p-4 space-y-4">
              <p className="text-xs text-slate-400">&quot;{autoFillTarget.name}&quot; grubuna seçtiğiniz kategorideki tüm ürünler eklenecek.</p>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Kategori</label>
                <div className="relative">
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40 appearance-none">
                    <option value="">Kategori seçin...</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
            <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.04]">
              <button onClick={() => setAutoFillTarget(null)} disabled={autoFillBusy} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">Vazgeç</button>
              <button onClick={autoFill} disabled={autoFillBusy || !selectedCategory} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-bold disabled:opacity-50">
                {autoFillBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />} Doldur
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
