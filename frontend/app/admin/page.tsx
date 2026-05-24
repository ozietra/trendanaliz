'use client';

import React, { useEffect, useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import { api } from '../../lib/api';
import {
  Users,
  CreditCard,
  Package,
  Store,
  AlertCircle,
  TrendingUp,
  Loader2,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  userCount: number;
  activeSubs: number;
  trialSubs: number; // Backend'de PENDING aboneliklerin sayısı (eski isim korundu)
  pendingPayments: number;
  storeCount: number;
  productCount: number;
  mrr: number;
  totalRevenue: number;
}

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/admin/stats');
        setStats(res.data?.data || null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'İstatistikler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmt = (n: number) => `₺${n.toLocaleString('tr-TR')}`;

  return (
    <>
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
            Süperadmin
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Genel Bakış
          </h1>
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
            <span className="text-xs text-slate-400">Yükleniyor...</span>
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard
                icon={<Users className="w-4 h-4" />}
                label="Toplam Kullanıcı"
                value={String(stats.userCount)}
                href="/admin/kullanicilar"
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="Aktif Abonelik"
                value={String(stats.activeSubs)}
                accent="emerald"
              />
              <StatCard
                icon={<Clock className="w-4 h-4" />}
                label="Bekleyen Abonelik"
                value={String(stats.trialSubs)}
                accent="amber"
              />
              <StatCard
                icon={<AlertCircle className="w-4 h-4" />}
                label="Bekleyen Ödeme"
                value={String(stats.pendingPayments)}
                accent={stats.pendingPayments > 0 ? 'red' : undefined}
                href="/admin/odemeler?status=PENDING"
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard
                icon={<CreditCard className="w-4 h-4" />}
                label="Bu Ay (MRR)"
                value={fmt(stats.mrr)}
                accent="emerald"
              />
              <StatCard
                icon={<CreditCard className="w-4 h-4" />}
                label="Toplam Ciro"
                value={fmt(stats.totalRevenue)}
              />
              <StatCard
                icon={<Store className="w-4 h-4" />}
                label="Mağazalar"
                value={String(stats.storeCount)}
              />
              <StatCard
                icon={<Package className="w-4 h-4" />}
                label="Ürünler"
                value={String(stats.productCount)}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <QuickLink
                title="Kullanıcı Yönetimi"
                desc="Hesapları görüntüle, devre dışı bırak veya rol ata"
                href="/admin/kullanicilar"
              />
              <QuickLink
                title="Plan Yönetimi"
                desc="Abonelik paketlerini oluştur, fiyatla ve yayınla"
                href="/admin/planlar"
              />
              <QuickLink
                title="Manuel Ödeme Onayı"
                desc="IBAN bildirilen ödemeleri doğrula"
                href="/admin/odemeler?status=PENDING"
              />
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'emerald' | 'amber' | 'red';
  href?: string;
}) {
  const color =
    accent === 'emerald'
      ? 'text-emerald-400'
      : accent === 'amber'
      ? 'text-amber-400'
      : accent === 'red'
      ? 'text-red-400'
      : 'text-white';

  const inner = (
    <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-2 mb-2 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function QuickLink({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="block bg-[#0b1424] border border-white/[0.04] hover:border-brand-orange/30 rounded-xl p-5 transition-colors"
    >
      <div className="text-sm font-bold text-white mb-1">{title}</div>
      <p className="text-[11px] text-slate-400">{desc}</p>
    </Link>
  );
}
