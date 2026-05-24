'use client';

import React, { useEffect, useState } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import { Loader2, Megaphone, Calculator, TrendingUp } from 'lucide-react';

interface Campaign {
  id: string;
  campaignName: string;
  type: string;
  startDate: string;
  endDate: string;
  budget: string;
  spend: string;
  revenue: string;
  roas: number;
  impressions: number;
  clicks: number;
  conversions: number;
  status: 'ACTIVE' | 'ENDED' | 'SCHEDULED';
}

interface Summary {
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  avgRoas: number;
  active: number;
  count: number;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ENDED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  SCHEDULED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function KampanyaRoiPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculator state
  const [calc, setCalc] = useState({
    salePrice: 299,
    listPrice: 399,
    expectedUnits: 100,
    productCost: 150,
    commissionRate: 18,
    couponPercent: 0,
    shippingCost: 15,
  });
  const [calcResult, setCalcResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/campaigns');
        setCampaigns(res.data?.data || []);
        setSummary(res.data?.summary || null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Kampanyalar yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const runCalc = async () => {
    setBusy(true);
    try {
      const res = await api.post('/campaigns/calculate', {
        ...calc,
        commissionRate: calc.commissionRate / 100,
      });
      setCalcResult(res.data?.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Hesaplama başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => `₺${n.toLocaleString('tr-TR')}`;

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
            Pazarlama Analizi
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Kampanya ROI
          </h1>
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <Stat label="Aktif" value={String(summary.active)} />
            <Stat label="Toplam Kampanya" value={String(summary.count)} />
            <Stat label="Toplam Harcama" value={fmt(summary.totalSpend)} />
            <Stat label="Toplam Ciro" value={fmt(summary.totalRevenue)} />
            <Stat label="Net Kâr" value={fmt(summary.totalProfit)} positive />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Campaign list */}
          <div className="lg:col-span-2 bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-brand-orange" />
              <h3 className="text-sm font-bold text-white">Kampanyalar</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
                <span className="text-xs text-slate-400">Yükleniyor...</span>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                Henüz kampanya yok.
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {campaigns.map((c) => (
                  <li key={c.id} className="p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {c.campaignName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.type}</div>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                          STATUS_STYLE[c.status] || STATUS_STYLE.ENDED
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <Inline label="Harcama" value={fmt(Number(c.spend))} />
                      <Inline label="Ciro" value={fmt(Number(c.revenue))} />
                      <Inline
                        label="ROAS"
                        value={`${c.roas.toFixed(2)}x`}
                        accent={c.roas >= 3 ? 'good' : c.roas >= 1 ? 'mid' : 'bad'}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ROI Calculator */}
          <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-brand-orange" />
              ROI Hesaplayıcı
            </h3>

            <div className="space-y-3">
              <Num
                label="Satış Fiyatı (₺)"
                value={calc.salePrice}
                onChange={(v) => setCalc({ ...calc, salePrice: v })}
              />
              <Num
                label="Liste Fiyatı (₺)"
                value={calc.listPrice}
                onChange={(v) => setCalc({ ...calc, listPrice: v })}
              />
              <Num
                label="Beklenen Adet"
                value={calc.expectedUnits}
                onChange={(v) => setCalc({ ...calc, expectedUnits: v })}
              />
              <Num
                label="Birim Maliyet (₺)"
                value={calc.productCost}
                onChange={(v) => setCalc({ ...calc, productCost: v })}
              />
              <Num
                label="Komisyon (%)"
                value={calc.commissionRate}
                onChange={(v) => setCalc({ ...calc, commissionRate: v })}
              />
              <Num
                label="Kupon İndirimi (%)"
                value={calc.couponPercent}
                onChange={(v) => setCalc({ ...calc, couponPercent: v })}
              />
              <Num
                label="Birim Kargo (₺)"
                value={calc.shippingCost}
                onChange={(v) => setCalc({ ...calc, shippingCost: v })}
              />

              <button
                onClick={runCalc}
                disabled={busy}
                className="w-full mt-2 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                <span>Hesapla</span>
              </button>

              {calcResult && (
                <div className="mt-4 pt-4 border-t border-white/[0.04] space-y-2">
                  <Result label="Birim Net Kâr" value={fmt(calcResult.perUnit.netProfit)} />
                  <Result label="Toplam Net Kâr" value={fmt(calcResult.totals.netProfit)} accent="good" />
                  <Result label="ROI" value={`%${calcResult.metrics.roi}`} accent="good" />
                  <Result
                    label="Başabaş Adet"
                    value={
                      calcResult.metrics.breakEvenUnits === null
                        ? '∞'
                        : `${calcResult.metrics.breakEvenUnits} adet`
                    }
                  />
                  <div className="text-[11px] text-slate-300 bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 leading-relaxed mt-2">
                    💡 {calcResult.recommendation}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-3">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
      <div className={`text-lg font-black mt-0.5 ${positive ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

function Inline({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'good' | 'mid' | 'bad';
}) {
  const color =
    accent === 'good'
      ? 'text-emerald-400'
      : accent === 'bad'
      ? 'text-red-400'
      : accent === 'mid'
      ? 'text-amber-400'
      : 'text-white';
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
      <div className={`text-xs font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-brand-orange/40 outline-none rounded-lg px-3 py-1.5 text-xs text-white"
      />
    </div>
  );
}

function Result({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'good' | 'bad';
}) {
  const color =
    accent === 'good' ? 'text-emerald-400' : accent === 'bad' ? 'text-red-400' : 'text-white';
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
