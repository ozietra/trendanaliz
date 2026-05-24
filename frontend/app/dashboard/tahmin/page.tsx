'use client';

import React, { useEffect, useState } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import { Loader2, TrendingUp, AlertTriangle, Package } from 'lucide-react';

interface ForecastItem {
  productId: string;
  title: string;
  barcode: string;
  currentStock: number;
  salePrice: number;
  dailyAvg: number;
  forecast7: { units: number; revenue: number; daily: number[] };
  forecast30: { units: number; revenue: number; daily: number[] };
  stockoutDays: number;
  warning: string | null;
}

interface Summary {
  totalUnits7: number;
  totalRevenue7: number;
  totalUnits30: number;
  totalRevenue30: number;
  stockoutRisk: number;
  productCount: number;
}

export default function TahminPage() {
  const [items, setItems] = useState<ForecastItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<7 | 30>(7);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/forecast/products');
        setItems(res.data?.data || []);
        setSummary(res.data?.summary || null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Tahmin yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmt = (n: number) => n.toLocaleString('tr-TR');

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
            Yapay Zeka Tahmini
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Satış Tahmini
          </h1>
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <StatBox label="Ürün" value={fmt(summary.productCount)} icon={<Package />} />
            <StatBox label="7G Adet" value={fmt(summary.totalUnits7)} icon={<TrendingUp />} />
            <StatBox label="7G Ciro" value={`₺${fmt(Math.round(summary.totalRevenue7))}`} />
            <StatBox label="30G Adet" value={fmt(summary.totalUnits30)} />
            <StatBox
              label="Stok Riski"
              value={fmt(summary.stockoutRisk)}
              warning={summary.stockoutRisk > 0}
            />
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Görünüm:
          </span>
          <button
            onClick={() => setHorizon(7)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              horizon === 7 ? 'bg-brand-orange text-white' : 'bg-white/5 text-slate-300'
            }`}
          >
            7 Gün
          </button>
          <button
            onClick={() => setHorizon(30)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              horizon === 30 ? 'bg-brand-orange text-white' : 'bg-white/5 text-slate-300'
            }`}
          >
            30 Gün
          </button>
        </div>

        <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
              <span className="text-xs text-slate-400">Tahminler hesaplanıyor...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Henüz ürün yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-white/[0.04]">
                    <th className="text-left p-3 font-semibold">Ürün</th>
                    <th className="text-right p-3 font-semibold">Stok</th>
                    <th className="text-right p-3 font-semibold">Günlük Ort.</th>
                    <th className="text-right p-3 font-semibold">{horizon}G Adet</th>
                    <th className="text-right p-3 font-semibold">{horizon}G Ciro</th>
                    <th className="text-left p-3 font-semibold">Trend</th>
                    <th className="text-right p-3 font-semibold">Stok Süresi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const f = horizon === 7 ? p.forecast7 : p.forecast30;
                    return (
                      <tr key={p.productId} className="border-b border-white/[0.02]">
                        <td className="p-3 text-white font-semibold max-w-xs truncate">
                          {p.title}
                        </td>
                        <td className="p-3 text-right text-slate-300">{p.currentStock}</td>
                        <td className="p-3 text-right text-slate-300">{p.dailyAvg}</td>
                        <td className="p-3 text-right text-white font-bold">{f.units}</td>
                        <td className="p-3 text-right text-emerald-400 font-bold">
                          ₺{fmt(Math.round(f.revenue))}
                        </td>
                        <td className="p-3">
                          <Sparkline values={f.daily} />
                        </td>
                        <td className="p-3 text-right">
                          {p.warning ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                              <AlertTriangle className="w-3 h-3" />
                              {p.stockoutDays}g
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              {p.stockoutDays > 99 ? '99+' : p.stockoutDays}g
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function StatBox({
  label,
  value,
  icon,
  warning,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        warning
          ? 'bg-amber-500/5 border-amber-500/20'
          : 'bg-[#0b1424] border-white/[0.04]'
      }`}
    >
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
        {icon && <span className="w-3 h-3">{icon}</span>}
        {label}
      </div>
      <div className={`text-lg font-black ${warning ? 'text-amber-400' : 'text-white'} mt-0.5`}>
        {value}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, 1);
  const w = 80;
  const h = 24;
  const step = w / (values.length - 1 || 1);
  const points = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-brand-orange"
        points={points}
      />
    </svg>
  );
}
