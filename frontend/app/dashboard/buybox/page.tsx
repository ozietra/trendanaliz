'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import {
  Loader2,
  Search,
  RefreshCw,
  Trophy,
  TrendingDown,
  Users,
  AlertCircle,
  CheckCircle2,
  Award,
  Package,
} from 'lucide-react';

interface Snapshot {
  buyboxOrder: number;
  buyboxPrice: string;
  hasMultipleSeller: boolean;
  secondBuyboxPrice: string | null;
  thirdBuyboxPrice: string | null;
  checkedAt: string;
}

interface BuyboxRow {
  productId: string;
  barcode: string;
  title: string;
  imageUrl: string | null;
  ownPrice: string;
  stockCount: number;
  storeId: string;
  storeName: string;
  snapshot: Snapshot | null;
  state: 'winning' | 'losing' | 'no-rivals' | 'unknown';
}

interface ListResponse {
  items: BuyboxRow[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  stats?: { winning: number; losing: number; noRivals: number; unknown: number; totalProducts: number };
}

const STATE_LABEL: Record<BuyboxRow['state'], string> = {
  winning: 'Kazanıyor',
  losing: 'Kaybediyor',
  'no-rivals': 'Rakipsiz',
  unknown: 'Bilinmiyor',
};

const STATE_BADGE: Record<BuyboxRow['state'], string> = {
  winning: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
  losing: 'bg-red-500/10 text-red-300 border-red-400/20',
  'no-rivals': 'bg-blue-500/10 text-blue-300 border-blue-400/20',
  unknown: 'bg-slate-500/10 text-slate-300 border-slate-400/20',
};

export default function BuyboxPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [stateFilter, setStateFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, size: 30 };
      if (stateFilter) params.state = stateFilter;
      if (searchDebounced) params.search = searchDebounced;
      const res = await api.get('/buybox', { params });
      setData(res.data?.data || null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'BuyBox verisi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, stateFilter, searchDebounced]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post('/buybox/sync');
      const stores = res.data?.data?.stores || [];
      const totalWritten = stores.reduce(
        (sum: number, s: any) => sum + (s.written || 0),
        0
      );
      setSuccess(
        `BuyBox tarama tamamlandı: ${stores.length} mağaza, ${totalWritten} snapshot yazıldı.`
      );
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'BuyBox taraması başarısız.');
    } finally {
      setSyncing(false);
    }
  };

  const stats = useMemo(() => {
    if (!data?.stats) return { winning: 0, losing: 0, noRivals: 0, total: 0 };
    return {
      winning: data.stats.winning,
      losing: data.stats.losing,
      noRivals: data.stats.noRivals,
      total: data.total,
    };
  }, [data]);

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-brand-orange" />
              BuyBox Durumu
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Trendyol resmi BuyBox Check Service'inden çekilen verilerle ürün
              başına sıralama ve fiyat. Veri en geç plan periyodunuzda
              yenilenir.
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>Şimdi Tara</span>
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
            icon={<Package className="w-4 h-4" />}
            label="BuyBox Rekabeti"
            value={String((data?.stats?.winning ?? 0) + (data?.stats?.losing ?? 0))}
            sub={`${data?.stats?.totalProducts ?? 0} üründen`}
          />
          <StatCard
            icon={<Trophy className="w-4 h-4" />}
            label="BuyBox Kazanan"
            value={String(stats.winning)}
            sub="bizdeyiz"
            accent="emerald"
          />
          <StatCard
            icon={<TrendingDown className="w-4 h-4" />}
            label="Kaybeden"
            value={String(stats.losing)}
            sub="rakip önde"
            accent="red"
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Rakipsiz"
            value={String(stats.noRivals)}
            sub="tek satıcı"
            accent="cyan"
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
              placeholder="Ürün başlığı veya barkod..."
              className="w-full pl-9 pr-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-brand-orange/40"
            />
          </div>
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setPage(0);
            }}
            className="bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white px-3 py-2 outline-none focus:border-brand-orange/40"
          >
            <option value="">Tüm Durumlar</option>
            <option value="winning">Kazanıyor</option>
            <option value="losing">Kaybediyor</option>
            <option value="no-rivals">Rakipsiz</option>
          </select>
        </section>

        {/* Tablo */}
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
                      <th className="text-left px-4 py-3 font-bold">Ürün</th>
                      <th className="text-left px-4 py-3 font-bold">Mağaza</th>
                      <th className="text-left px-4 py-3 font-bold">Bizim Fiyat</th>
                      <th className="text-left px-4 py-3 font-bold">BuyBox Fiyat</th>
                      <th className="text-left px-4 py-3 font-bold">2./3. Rakip</th>
                      <th className="text-left px-4 py-3 font-bold">Sıra</th>
                      <th className="text-left px-4 py-3 font-bold">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {data.items.map((row) => {
                      const snap = row.snapshot;
                      return (
                        <tr key={row.productId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {row.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={row.imageUrl}
                                  alt=""
                                  className="w-9 h-9 rounded object-cover bg-white/5 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded bg-white/5 flex items-center justify-center shrink-0">
                                  <Package className="w-4 h-4 text-slate-500" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-slate-200 truncate max-w-[280px]">{row.title}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{row.barcode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{row.storeName}</td>
                          <td className="px-4 py-3 font-bold text-white">
                            ₺{Number(row.ownPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-slate-200">
                            {snap ? `₺${Number(snap.buyboxPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-[11px]">
                            {snap?.secondBuyboxPrice
                              ? `₺${Number(snap.secondBuyboxPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                              : '—'}
                            {snap?.thirdBuyboxPrice
                              ? ` / ₺${Number(snap.thirdBuyboxPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                              : ''}
                          </td>
                          <td className="px-4 py-3 text-slate-300 font-mono">
                            {snap ? `#${snap.buyboxOrder}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${STATE_BADGE[row.state]}`}
                            >
                              {STATE_LABEL[row.state]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {data.totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-white/[0.04] text-xs">
                  <span className="text-slate-400">
                    Toplam {data.total} ürün — sayfa {data.page + 1}/{data.totalPages}
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

        <p className="text-[11px] text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Veri Kaynağı:</strong> Trendyol
          Marketplace API <code className="text-slate-300">/integration/product/sellers/{`{sellerId}`}/products/buybox-information</code>.
          Bu servis, sizin barkodlarınız için BuyBox kazananın fiyatını ve ilk 3
          rakip fiyatını döner. Rakip <em>satıcı kimliği</em> resmi API'de
          paylaşılmaz; bu yüzden satıcı adı yerine sıralama ve fiyat
          gösterilmektedir.
        </p>
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
  accent?: 'orange' | 'emerald' | 'cyan' | 'red' | 'amber';
}) {
  const accentMap: Record<string, string> = {
    orange: 'bg-brand-orange/10 text-brand-orange',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
    red: 'bg-red-500/10 text-red-400',
    amber: 'bg-amber-500/10 text-amber-400',
  };
  return (
    <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-3 md:p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            accent ? accentMap[accent] : 'bg-white/5 text-slate-300'
          }`}
        >
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
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
        <Award className="w-5 h-5 text-slate-500" />
      </div>
      <h3 className="text-sm font-bold text-white">BuyBox rekabeti bulunamadı</h3>
      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
        Bu ekranda yalnızca birden fazla satıcısı olan ürünler listelenir.
        Arka planda Trendyol BuyBox API&apos;si ile ürünleriniz taranır ve
        rakipli ürünler otomatik olarak burada görünür.
        İlk tarama için yukarıdaki &quot;Şimdi Tara&quot; butonuna basabilirsiniz.
      </p>
    </div>
  );
}
