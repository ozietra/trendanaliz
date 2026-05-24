'use client';

import React, { useEffect, useState } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import { Loader2, Search, Package, CheckCircle2, XCircle, Power } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  listPrice: number;
  competitorPrice: number;
  buybox: boolean;
  categoryName: string | null;
  minPrice: number;
  maxPrice: number;
  rule: string;
  repricerActive: boolean;
}

export default function UrunlerimPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'lost'>('all');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (q) params.q = q;
      if (filter === 'lost') params.buybox = 'lost';
      const res = await api.get('/products', { params });
      setProducts(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ürünler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const toggleRepricer = async (p: Product) => {
    try {
      await api.put(`/products/${p.id}/repricer`, { active: !p.repricerActive });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Durum değiştirilemedi.');
    }
  };

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
            Trendyol Kataloğu
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Ürünlerim</h1>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Ürün adı veya barkod ara..."
              className="w-full bg-[#0b1424] border border-white/[0.06] focus:border-brand-orange/40 outline-none rounded-lg pl-10 pr-3 py-2 text-xs text-white placeholder-slate-600"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold ${
                filter === 'all'
                  ? 'bg-brand-orange text-white'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Tümü
            </button>
            <button
              onClick={() => setFilter('lost')}
              className={`px-4 py-2 rounded-lg text-xs font-bold ${
                filter === 'lost'
                  ? 'bg-brand-orange text-white'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Buybox Kaybedilen
            </button>
            <button
              onClick={load}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-slate-300 hover:bg-white/10"
            >
              Yenile
            </button>
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
              <span className="text-xs text-slate-400">Ürünler yükleniyor...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-semibold">Henüz ürün bulunamadı.</p>
              <p className="text-xs text-slate-500 mt-1">
                Önce mağazanızı entegre edin: <a href="/dashboard/magaza/ekle" className="text-brand-orange">Mağaza Ekle</a>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04] text-slate-500">
                    <th className="text-left p-3 font-semibold">Ürün</th>
                    <th className="text-left p-3 font-semibold hidden lg:table-cell">Kategori</th>
                    <th className="text-left p-3 font-semibold hidden md:table-cell">Barkod</th>
                    <th className="text-right p-3 font-semibold">Fiyatım</th>
                    <th className="text-right p-3 font-semibold hidden md:table-cell">Rakip</th>
                    <th className="text-center p-3 font-semibold">Buybox</th>
                    <th className="text-right p-3 font-semibold">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                      <td className="p-3 text-white max-w-xs truncate">{p.name}</td>
                      <td className="p-3 text-slate-400 text-[10px] hidden lg:table-cell max-w-[120px] truncate" title={p.categoryName || '—'}>{p.categoryName || '—'}</td>
                      <td className="p-3 text-slate-400 font-mono hidden md:table-cell">{p.sku}</td>
                      <td className="p-3 text-right text-white font-bold">
                        ₺{p.price.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-slate-400 hidden md:table-cell">
                        ₺{p.competitorPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        {p.buybox ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 inline" />
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => toggleRepricer(p)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold ${
                            p.repricerActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {p.repricerActive ? 'Aktif' : 'Pasif'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
