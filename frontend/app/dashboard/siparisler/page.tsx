'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import {
  Loader2,
  Search,
  ShoppingBag,
  RefreshCw,
  Package,
  CheckCircle2,
  XCircle,
  Truck,
  Clock,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

interface OrderItem {
  id: string;
  barcode: string;
  productName: string;
  quantity: number;
  price: string;
  amount: string;
  productSize?: string | null;
  productColor?: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  shipmentPackageId: string;
  status: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  totalPrice: string;
  currencyCode: string;
  orderDate: string;
  estimatedDeliveryEnd?: string | null;
  cargoTrackingNumber?: string | null;
  cargoProviderName?: string | null;
  cargoTrackingLink?: string | null;
  fastDelivery: boolean;
  items: OrderItem[];
}

interface ListResponse {
  items: Order[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

interface SummaryResponse {
  totalCount: number;
  totalRevenue: number;
  byStatus: Record<string, number>;
  recentDays: Array<{ date: string; count: number; revenue: number }>;
}

const STATUS_LABEL: Record<string, string> = {
  Created: 'Oluşturuldu',
  Picking: 'Hazırlanıyor',
  Invoiced: 'Faturalandı',
  Shipped: 'Kargoda',
  ShippedToCollectionPoint: 'Şubeye Yönlendirildi',
  AtCollectionPoint: 'Şubede',
  Delivered: 'Teslim Edildi',
  UnDelivered: 'Teslim Edilemedi',
  UnDeliveredAndReturned: 'Teslim Edilemedi (İade)',
  Cancelled: 'İptal',
  Returned: 'İade',
  Awaiting: 'Bekliyor',
  UnSupplied: 'Tedarik Edilemedi',
  UnPacked: 'Paket Açıldı',
  Repack: 'Yeniden Paketlendi',
};

const STATUS_BADGE: Record<string, string> = {
  Created: 'bg-blue-500/10 text-blue-300 border-blue-400/20',
  Picking: 'bg-amber-500/10 text-amber-300 border-amber-400/20',
  Invoiced: 'bg-indigo-500/10 text-indigo-300 border-indigo-400/20',
  Shipped: 'bg-cyan-500/10 text-cyan-300 border-cyan-400/20',
  Delivered: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
  Cancelled: 'bg-red-500/10 text-red-300 border-red-400/20',
  Returned: 'bg-red-500/10 text-red-300 border-red-400/20',
};

const FILTER_STATUSES = [
  'Created',
  'Picking',
  'Invoiced',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Returned',
];

export default function SiparislerPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Debounce arama
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, size: 20 };
      if (statusFilter) params.status = statusFilter;
      if (searchDebounced) params.search = searchDebounced;
      const res = await api.get('/orders', { params });
      setData(res.data?.data || null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Siparişler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await api.get('/orders/summary', { params: { days: 30 } });
      setSummary(res.data?.data || null);
    } catch {
      // Özet kritik değil, sessizce yut
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, searchDebounced]);

  useEffect(() => {
    loadSummary();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post('/orders/sync');
      setSuccess(res.data?.message || 'Senkronizasyon tamamlandı.');
      await Promise.all([loadList(), loadSummary()]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Senkronizasyon başarısız.');
    } finally {
      setSyncing(false);
    }
  };

  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalCount = summary?.totalCount ?? 0;
  const shippedCount = summary?.byStatus?.Shipped ?? 0;
  const deliveredCount = summary?.byStatus?.Delivered ?? 0;

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Başlık */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-brand-orange" />
              Siparişler
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Trendyol mağazanızdaki siparişler. Otomatik senkronizasyon 5 dakikada bir çalışır.
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>Şimdi Senkronize Et</span>
          </button>
        </header>

        {/* Bildirimler */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Özet Kartları */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<ShoppingBag className="w-4 h-4" />}
            label="Son 30 Gün"
            value={String(totalCount)}
            sub="sipariş"
            accent="orange"
          />
          <StatCard
            icon={<Package className="w-4 h-4" />}
            label="Gelir (30g)"
            value={`₺${totalRevenue.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`}
            sub="iptal/iade hariç"
            accent="emerald"
          />
          <StatCard
            icon={<Truck className="w-4 h-4" />}
            label="Kargoda"
            value={String(shippedCount)}
            sub="açık paket"
            accent="cyan"
          />
          <StatCard
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Teslim Edildi"
            value={String(deliveredCount)}
            sub="son 30 gün"
            accent="emerald"
          />
        </section>

        {/* Filtre Çubuğu */}
        <section className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Sipariş no, müşteri adı veya e-posta..."
              className="w-full pl-9 pr-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-brand-orange/40"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white px-3 py-2 outline-none focus:border-brand-orange/40"
          >
            <option value="">Tüm Durumlar</option>
            {FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </section>

        {/* Sipariş Tablosu */}
        <section className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 text-brand-orange animate-spin mx-auto" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#070c16] border-b border-white/[0.04] text-slate-400">
                    <tr>
                      <th className="text-left px-4 py-3 font-bold">Sipariş No</th>
                      <th className="text-left px-4 py-3 font-bold">Müşteri</th>
                      <th className="text-left px-4 py-3 font-bold">Tarih</th>
                      <th className="text-left px-4 py-3 font-bold">Tutar</th>
                      <th className="text-left px-4 py-3 font-bold">Durum</th>
                      <th className="text-left px-4 py-3 font-bold">Kalem</th>
                      <th className="text-right px-4 py-3 font-bold">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {data.items.map((o) => (
                      <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-200">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {o.customerFirstName || o.customerLastName
                            ? `${o.customerFirstName ?? ''} ${o.customerLastName ?? ''}`.trim()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(o.orderDate).toLocaleString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 font-bold text-white">
                          ₺{Number(o.totalPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              STATUS_BADGE[o.status] ||
                              'bg-slate-500/10 text-slate-300 border-slate-400/20'
                            }`}
                          >
                            {STATUS_LABEL[o.status] || o.status}
                          </span>
                          {o.fastDelivery && (
                            <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-300 border border-purple-400/20">
                              HIZLI
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{o.items.length}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/dashboard/siparisler/${o.id}`}
                            className="inline-flex items-center gap-1 text-brand-orange hover:underline font-bold"
                          >
                            Detay <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sayfalama */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-white/[0.04] text-xs">
                  <span className="text-slate-400">
                    Toplam {data.total} sipariş — sayfa {data.page + 1}/{data.totalPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                      className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30"
                    >
                      Önceki
                    </button>
                    <button
                      disabled={page + 1 >= data.totalPages}
                      onClick={() => setPage(page + 1)}
                      className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30"
                    >
                      Sonraki
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'orange' | 'emerald' | 'cyan' | 'amber';
}) {
  const accentMap: Record<string, string> = {
    orange: 'bg-brand-orange/10 text-brand-orange',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
    amber: 'bg-amber-500/10 text-amber-400',
  };
  return (
    <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-3 md:p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent ? accentMap[accent] : 'bg-white/5 text-slate-300'}`}>
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="text-lg md:text-xl font-extrabold text-white">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
        <Package className="w-5 h-5 text-slate-500" />
      </div>
      <h3 className="text-sm font-bold text-white">Henüz sipariş yok</h3>
      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
        Trendyol mağazanızda yeni bir sipariş oluştuğunda burada listelenecek.
        Hemen senkronize etmek için yukarıdaki butonu kullanabilirsiniz.
      </p>
    </div>
  );
}
