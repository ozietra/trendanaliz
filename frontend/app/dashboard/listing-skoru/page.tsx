'use client';

import React, { useEffect, useState } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import { Loader2, Star, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

interface ScoredProduct {
  productId: string;
  title: string;
  barcode: string;
  score: number;
  breakdown: {
    title: number;
    price: number;
    stock: number;
    buybox: number;
    competitor: number;
  };
  suggestions: string[];
}

const MAX = { title: 25, price: 25, stock: 15, buybox: 20, competitor: 15 };

export default function ListingSkoruPage() {
  const [items, setItems] = useState<ScoredProduct[]>([]);
  const [meta, setMeta] = useState<{ avgScore: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/listings/scores');
        setItems(res.data?.data || []);
        setMeta(res.data?.meta || null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Skorlar yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
              Listing Kalite Analizi
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Listing Skoru ve Önerileri
            </h1>
          </div>
          {meta && meta.total > 0 && (
            <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl px-5 py-3 flex items-center gap-3">
              <Star className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-[9px] uppercase text-slate-500 font-bold">Ortalama Skor</div>
                <div className="text-2xl font-black text-white">
                  {meta.avgScore}
                  <span className="text-xs text-slate-500"> / 100</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
            <span className="text-xs text-slate-400">Skorlar hesaplanıyor...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl py-16 text-center text-sm text-slate-400">
            Henüz ürün yok.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((p) => {
              const isOpen = openId === p.productId;
              const scoreColor =
                p.score >= 75 ? 'text-emerald-400' : p.score >= 50 ? 'text-amber-400' : 'text-red-400';
              return (
                <div key={p.productId} className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenId(isOpen ? null : p.productId)}
                    className="w-full p-4 flex items-center gap-3 hover:bg-white/[0.01] text-left"
                  >
                    <div className={`text-2xl font-black ${scoreColor} w-12 text-center`}>{p.score}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{p.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{p.barcode}</div>
                    </div>
                    {p.suggestions.length > 0 && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {p.suggestions.length} öneri
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/[0.04] p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                          Skor Dağılımı
                        </h4>
                        <div className="space-y-2">
                          {(Object.entries(p.breakdown) as Array<[keyof typeof MAX, number]>).map(
                            ([k, v]) => (
                              <BreakdownRow key={k} label={LABELS[k]} value={v} max={MAX[k]} />
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                          İyileştirme Önerileri
                        </h4>
                        {p.suggestions.length === 0 ? (
                          <p className="text-xs text-emerald-400">
                            Bu listing skoru zaten yüksek, somut bir öneri yok. 🎉
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {p.suggestions.map((s, i) => (
                              <li key={i} className="text-xs text-slate-300 flex gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

const LABELS: Record<string, string> = {
  title: 'Başlık',
  price: 'Fiyatlandırma',
  stock: 'Stok',
  buybox: 'Buybox',
  competitor: 'Rakip Pozisyonu',
};

function BreakdownRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-bold">
          {value} / {max}
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${
            pct >= 75 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
