'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import {
  Loader2, TrendingDown, TrendingUp, DollarSign, Percent,
  Edit2, Check, X, AlertTriangle, Download, RefreshCw,
  Package, ChevronUp, ChevronDown, Search,
} from 'lucide-react';

// ---------- Types ----------
interface ProfitItem {
  barcode: string;
  title: string;
  categoryName: string | null;
  imageUrl: string | null;
  stockCount: number;
  salePrice: number;
  listPrice: number;
  vatRate: number;
  costPrice: number | null;
  shippingCost: number | null;
  commissionRate: number | null;
  netRevenue: number | null;
  commissionAmount: number | null;
  netProfit: number | null;
  profitMargin: number | null;
  status: 'profit' | 'loss' | 'break_even' | 'incomplete';
  hasCommission: boolean;
  hasCostPrice: boolean;
}

interface ProfitSummary {
  totalProducts: number;
  completeCount: number;
  incompleteCount: number;
  profitableCount: number;
  lossCount: number;
  totalRevenue: number;
  totalCost: number;
  totalNetProfit: number;
  avgMargin: number;
}

// ---------- Helpers ----------
const fmt = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StatusBadge = ({ status }: { status: ProfitItem['status'] }) => {
  if (status === 'profit')
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Kâr</span>;
  if (status === 'loss')
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">Zarar</span>;
  if (status === 'break_even')
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/20">Başa Baş</span>;
  return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">Eksik</span>;
};

// ---------- Component ----------
export default function KarZararPage() {
  const [tab, setTab] = useState<'input' | 'report'>('input');
  const [items, setItems] = useState<ProfitItem[]>([]);
  const [summary, setSummary] = useState<ProfitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof ProfitItem>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // inline edit state: barcode → { costPrice, shippingCost }
  const [edits, setEdits] = useState<Record<string, { costPrice: string; shippingCost: string }>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/profit/report');
      setItems(res.data?.data?.items || []);
      setSummary(res.data?.data?.summary || null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Rapor yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Initialize edits from loaded data
  useEffect(() => {
    const map: Record<string, { costPrice: string; shippingCost: string }> = {};
    for (const item of items) {
      map[item.barcode] = {
        costPrice: item.costPrice != null ? String(item.costPrice) : '',
        shippingCost: item.shippingCost != null ? String(item.shippingCost) : '',
      };
    }
    setEdits(map);
  }, [items]);

  const saveCost = async (barcode: string) => {
    const edit = edits[barcode];
    if (!edit) return;
    setSaving((s) => ({ ...s, [barcode]: true }));
    setError(null);
    try {
      await api.patch(`/profit/cost/${barcode}`, {
        costPrice: edit.costPrice !== '' ? Number(edit.costPrice) : null,
        shippingCost: edit.shippingCost !== '' ? Number(edit.shippingCost) : null,
      });
      setSuccess('Kaydedildi.');
      setTimeout(() => setSuccess(null), 2000);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kaydedilemedi.');
    } finally {
      setSaving((s) => ({ ...s, [barcode]: false }));
    }
  };

  const saveAll = async () => {
    setSaving({ __all: true });
    setError(null);
    try {
      const payload = Object.entries(edits)
        .map(([barcode, e]) => ({
          barcode,
          costPrice: e.costPrice !== '' ? Number(e.costPrice) : null,
          shippingCost: e.shippingCost !== '' ? Number(e.shippingCost) : null,
        }));
      await api.patch('/profit/bulk-cost', { items: payload });
      setSuccess('Tüm fiyatlar kaydedildi.');
      setTimeout(() => setSuccess(null), 3000);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Toplu kaydetme başarısız.');
    } finally {
      setSaving({});
    }
  };

  const handlePrint = () => window.print();

  const toggleSort = (key: keyof ProfitItem) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filteredItems = items
    .filter((i) =>
      !search ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      (i.categoryName || '').toLowerCase().includes(search.toLowerCase()) ||
      i.barcode.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ k }: { k: keyof ProfitItem }) =>
    sortKey === k
      ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      : null;

  const anyUnsaved = items.some((i) => {
    const e = edits[i.barcode];
    if (!e) return false;
    return (
      (e.costPrice !== '' ? Number(e.costPrice) : null) !== i.costPrice ||
      (e.shippingCost !== '' ? Number(e.shippingCost) : null) !== i.shippingCost
    );
  });

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16] print:p-0 print:bg-white" ref={printRef}>

        {/* Sayfa başlığı */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
          <div>
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Finans</div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-brand-orange" />
              Kar-Zarar Hesaplama
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition" title="Yenile">
              <RefreshCw className="w-4 h-4" />
            </button>
            {tab === 'report' && (
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold transition"
              >
                <Download className="w-4 h-4" />
                PDF İndir
              </button>
            )}
            {tab === 'input' && anyUnsaved && (
              <button
                onClick={saveAll}
                disabled={!!saving.__all}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {saving.__all ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Tümünü Kaydet
              </button>
            )}
          </div>
        </div>

        {/* Bildirimler */}
        {error && <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4 print:hidden">{error}</div>}
        {success && <div className="text-emerald-400 text-xs bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 mb-4 print:hidden">{success}</div>}

        {/* Sekmeler */}
        <div className="flex gap-1 mb-5 print:hidden">
          {(['input', 'report'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                tab === t
                  ? 'bg-brand-orange text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {t === 'input' ? '📦 Alış Fiyatı Girişi' : '📊 Kar-Zarar Raporu'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
            <span className="text-sm text-slate-400">Yükleniyor...</span>
          </div>
        ) : (
          <>
            {/* ======== SEKME 1: ALIŞ FİYATI GİRİŞİ ======== */}
            {tab === 'input' && (
              <div className="print:hidden">
                {/* Bilgi notu */}
                <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 mb-4 text-xs text-blue-300/80">
                  <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Her ürün için alış fiyatını girin. Kargo maliyeti opsiyoneldir — sabit bir tutar girebilir ya da boş bırakabilirsiniz.
                    Komisyon oranları <a href="/dashboard/komisyon" className="underline text-blue-300">Komisyon Oranları</a> sayfasından yönetilir.
                  </span>
                </div>

                {/* Arama */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ürün ara..."
                    className="w-full pl-8 pr-4 py-2 bg-[#0b1424] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40"
                  />
                </div>

                <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#070c16] text-slate-400">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold">Ürün</th>
                          <th className="text-right px-3 py-3 font-semibold">Satış Fiyatı</th>
                          <th className="text-right px-3 py-3 font-semibold">Komisyon</th>
                          <th className="text-right px-3 py-3 font-semibold">
                            Alış Fiyatı <span className="text-brand-orange">*</span>
                          </th>
                          <th className="text-right px-3 py-3 font-semibold">Kargo</th>
                          <th className="text-center px-3 py-3 font-semibold w-16">Kaydet</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {filteredItems.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-slate-500">
                              <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                              {search ? 'Arama sonucu bulunamadı.' : 'Ürün bulunamadı.'}
                            </td>
                          </tr>
                        )}
                        {filteredItems.map((item) => {
                          const edit = edits[item.barcode] || { costPrice: '', shippingCost: '' };
                          const isSavingThis = saving[item.barcode];
                          return (
                            <tr key={item.barcode} className="hover:bg-white/[0.015]">
                              {/* Ürün adı */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {item.imageUrl && (
                                    <img src={item.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0 bg-white/5" />
                                  )}
                                  <div>
                                    <div className="text-white font-semibold line-clamp-1 max-w-[220px]">{item.title}</div>
                                    <div className="text-slate-500 text-[10px] mt-0.5">{item.categoryName || '—'}</div>
                                  </div>
                                </div>
                              </td>
                              {/* Satış fiyatı */}
                              <td className="px-3 py-3 text-right text-white font-bold">
                                ₺{fmt(item.salePrice)}
                              </td>
                              {/* Komisyon */}
                              <td className="px-3 py-3 text-right">
                                {item.hasCommission ? (
                                  <span className="text-slate-300">%{item.commissionRate}</span>
                                ) : (
                                  <span className="text-amber-400 text-[10px]">Girilmemiş</span>
                                )}
                              </td>
                              {/* Alış fiyatı — düzenlenebilir */}
                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-slate-500">₺</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={edit.costPrice}
                                    onChange={(e) =>
                                      setEdits((prev) => ({
                                        ...prev,
                                        [item.barcode]: { ...prev[item.barcode], costPrice: e.target.value },
                                      }))
                                    }
                                    placeholder="0.00"
                                    className="w-24 px-2 py-1 bg-[#070c16] border border-white/[0.06] rounded text-xs text-white outline-none focus:border-brand-orange/40 text-right"
                                  />
                                </div>
                              </td>
                              {/* Kargo — düzenlenebilir */}
                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-slate-500">₺</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={edit.shippingCost}
                                    onChange={(e) =>
                                      setEdits((prev) => ({
                                        ...prev,
                                        [item.barcode]: { ...prev[item.barcode], shippingCost: e.target.value },
                                      }))
                                    }
                                    placeholder="0.00"
                                    className="w-20 px-2 py-1 bg-[#070c16] border border-white/[0.06] rounded text-xs text-white outline-none focus:border-brand-orange/40 text-right"
                                  />
                                </div>
                              </td>
                              {/* Kaydet butonu */}
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => saveCost(item.barcode)}
                                  disabled={isSavingThis}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-400 transition disabled:opacity-40"
                                  title="Kaydet"
                                >
                                  {isSavingThis ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======== SEKME 2: KAR-ZARAR RAPORU ======== */}
            {tab === 'report' && (
              <div>
                {/* Özet Kartlar */}
                {summary && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 print:grid-cols-4">
                    <SummaryCard
                      label="Toplam Ciro"
                      value={`₺${fmt(summary.totalRevenue)}`}
                      icon={<DollarSign className="w-4 h-4" />}
                      color="orange"
                    />
                    <SummaryCard
                      label="Toplam Maliyet"
                      value={`₺${fmt(summary.totalCost)}`}
                      icon={<TrendingDown className="w-4 h-4" />}
                      color="red"
                    />
                    <SummaryCard
                      label="Net Kâr"
                      value={`₺${fmt(summary.totalNetProfit)}`}
                      icon={<TrendingUp className="w-4 h-4" />}
                      color={summary.totalNetProfit >= 0 ? 'green' : 'red'}
                      sub={`${summary.profitableCount} kârlı / ${summary.lossCount} zararlı ürün`}
                    />
                    <SummaryCard
                      label="Ort. Kâr Marjı"
                      value={`%${summary.avgMargin}`}
                      icon={<Percent className="w-4 h-4" />}
                      color={summary.avgMargin >= 0 ? 'green' : 'red'}
                      sub={`${summary.completeCount}/${summary.totalProducts} ürün hesaplandı`}
                    />
                  </div>
                )}

                {/* Print başlığı */}
                <div className="hidden print:block mb-6">
                  <h1 className="text-2xl font-black text-gray-900">Kar-Zarar Raporu</h1>
                  <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString('tr-TR', { dateStyle: 'long' })}</p>
                </div>

                {/* Eksik ürün uyarısı */}
                {summary && summary.incompleteCount > 0 && (
                  <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 mb-4 text-xs text-amber-300/80 print:hidden">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <b>{summary.incompleteCount} ürün</b> için alış fiyatı veya komisyon oranı eksik — bu ürünler raporda "Eksik" olarak görünür.
                    </span>
                  </div>
                )}

                {/* Arama */}
                <div className="relative mb-3 print:hidden">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ürün ara..."
                    className="w-full pl-8 pr-4 py-2 bg-[#0b1424] border border-white/[0.06] rounded-lg text-xs text-white outline-none focus:border-brand-orange/40"
                  />
                </div>

                {/* Rapor Tablosu */}
                <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden print:border-gray-200 print:rounded-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs print:text-[11px]">
                      <thead className="bg-[#070c16] text-slate-400 print:bg-gray-100 print:text-gray-600">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold cursor-pointer" onClick={() => toggleSort('title')}>
                            <span className="flex items-center gap-1">Ürün <SortIcon k="title" /></span>
                          </th>
                          <th className="text-right px-3 py-3 font-semibold cursor-pointer" onClick={() => toggleSort('salePrice')}>
                            <span className="flex items-center justify-end gap-1">Satış <SortIcon k="salePrice" /></span>
                          </th>
                          <th className="text-right px-3 py-3 font-semibold">Komisyon</th>
                          <th className="text-right px-3 py-3 font-semibold">Kargo</th>
                          <th className="text-right px-3 py-3 font-semibold cursor-pointer" onClick={() => toggleSort('costPrice')}>
                            <span className="flex items-center justify-end gap-1">Alış <SortIcon k="costPrice" /></span>
                          </th>
                          <th className="text-right px-3 py-3 font-semibold cursor-pointer" onClick={() => toggleSort('netProfit')}>
                            <span className="flex items-center justify-end gap-1">Net Kâr <SortIcon k="netProfit" /></span>
                          </th>
                          <th className="text-right px-3 py-3 font-semibold cursor-pointer" onClick={() => toggleSort('profitMargin')}>
                            <span className="flex items-center justify-end gap-1">Marj <SortIcon k="profitMargin" /></span>
                          </th>
                          <th className="text-center px-3 py-3 font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03] print:divide-gray-200">
                        {filteredItems.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-12 text-slate-500">
                              <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                              Ürün bulunamadı.
                            </td>
                          </tr>
                        )}
                        {filteredItems.map((item) => (
                          <tr
                            key={item.barcode}
                            className={`hover:bg-white/[0.015] print:hover:bg-transparent ${
                              item.status === 'profit' ? 'border-l-2 border-l-emerald-500/30' :
                              item.status === 'loss' ? 'border-l-2 border-l-red-500/30' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-white line-clamp-1 max-w-[220px] print:text-gray-900">{item.title}</div>
                              <div className="text-slate-500 text-[10px] print:text-gray-400">{item.categoryName || '—'}</div>
                            </td>
                            <td className="px-3 py-3 text-right text-white font-bold print:text-gray-900">₺{fmt(item.salePrice)}</td>
                            <td className="px-3 py-3 text-right">
                              {item.commissionAmount != null ? (
                                <div>
                                  <div className="text-slate-300 print:text-gray-700">₺{fmt(item.commissionAmount)}</div>
                                  <div className="text-slate-500 text-[10px]">%{item.commissionRate}</div>
                                </div>
                              ) : (
                                <span className="text-amber-400 text-[10px]">Eksik</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right text-slate-300 print:text-gray-700">
                              {item.shippingCost != null ? `₺${fmt(item.shippingCost)}` : '—'}
                            </td>
                            <td className="px-3 py-3 text-right text-slate-300 print:text-gray-700">
                              {item.costPrice != null ? `₺${fmt(item.costPrice)}` : <span className="text-amber-400 text-[10px]">Eksik</span>}
                            </td>
                            <td className="px-3 py-3 text-right font-bold">
                              {item.netProfit != null ? (
                                <span className={item.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {item.netProfit >= 0 ? '+' : ''}₺{fmt(item.netProfit)}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-3 text-right font-bold">
                              {item.profitMargin != null ? (
                                <span className={item.profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  %{item.profitMargin.toFixed(1)}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <StatusBadge status={item.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Print stiller */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: #111 !important; }
          aside, .print\\:hidden { display: none !important; }
          main { padding: 0 !important; background: white !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}

// ---------- Summary Card ----------
function SummaryCard({
  label, value, icon, color, sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'orange' | 'green' | 'red' | 'blue';
  sub?: string;
}) {
  const colorMap = {
    orange: 'text-brand-orange bg-brand-orange/10 border-brand-orange/20',
    green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };
  const valColor = {
    orange: 'text-brand-orange',
    green: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };
  return (
    <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4 print:border-gray-200 print:rounded">
      <div className="flex items-center gap-2 mb-2">
        <span className={`p-1.5 rounded-lg border ${colorMap[color]}`}>{icon}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl font-black ${valColor[color]} print:text-gray-900`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-1 print:text-gray-400">{sub}</div>}
    </div>
  );
}
