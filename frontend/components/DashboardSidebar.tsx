'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Store,
  Package,
  Search,
  Sliders,
  Tag,
  Star,
  TrendingUp,
  Megaphone,
  Bell,
  CreditCard,
  ShieldCheck,
  ShoppingBag,
  FolderOpen,
  DollarSign,
  Percent,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';

const NAV = [
  { href: '/dashboard', label: 'Genel Durum', icon: BarChart3 },
  { href: '/dashboard/magaza/ekle', label: 'Mağaza Ekle', icon: Store },
  { href: '/dashboard/urunlerim', label: 'Ürünlerim', icon: Package },
  { href: '/dashboard/urun-gruplari', label: 'Ürün Grupları', icon: FolderOpen },
  { href: '/dashboard/siparisler', label: 'Siparişler', icon: ShoppingBag },
  { href: '/dashboard/buybox', label: 'BuyBox Durumu', icon: Search },
  { href: '/dashboard/fiyat-kurallari', label: 'Fiyat Kuralları', icon: Sliders },
  { href: '/dashboard/toplu-fiyat', label: 'Toplu Fiyatlandırma', icon: DollarSign },
  { href: '/dashboard/komisyon', label: 'Komisyonlar', icon: Percent },
  { href: '/dashboard/listing-skoru', label: 'Listing Skoru', icon: Star },
  { href: '/dashboard/tahmin', label: 'Satış Tahmini', icon: TrendingUp },
  { href: '/dashboard/kampanya-roi', label: 'Kampanya ROI', icon: Megaphone },
  { href: '/dashboard/bildirimler', label: 'Bildirimler', icon: Bell },
  { href: '/dashboard/abonelik', label: 'Abonelik', icon: CreditCard },
];

interface SubInfo {
  status: string;
  planName: string;
  hoursLeft: number;
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const [sub, setSub] = useState<SubInfo | null>(null);

  useEffect(() => {
    api.get('/subscriptions/me').then((res) => {
      const d = res.data?.data;
      if (d && d.status) {
        const end = new Date(d.endDate).getTime();
        const hoursLeft = Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60)));
        setSub({ status: d.status, planName: d.plan?.name || d.planName || 'Plan', hoursLeft });
      }
    }).catch(() => {});
  }, []);

  return (
    <aside className="w-12 md:w-52 border-r border-white/[0.04] bg-[#09101d] p-2 md:p-3 flex flex-col shrink-0 select-none overflow-y-auto">
      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2 py-2 hidden md:block">
        Yönetim Paneli
      </div>
      <nav className="space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full text-left px-2 md:px-3 py-2 md:py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center md:justify-start gap-2 md:gap-3 transition-all ${
                active
                  ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/10'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
              title={item.label}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Abonelik Durumu Badge */}
      <div className="mt-3 pt-3 border-t border-white/[0.04] hidden md:block">
        {sub ? (
          sub.status === 'TRIAL' ? (
            <Link href="/dashboard/abonelik" className="block px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-all">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[10px] font-bold text-amber-400">Deneme</span>
              </div>
              <div className="text-[9px] text-amber-300/70 mt-0.5">{sub.hoursLeft} saat kaldı</div>
            </Link>
          ) : sub.status === 'ACTIVE' ? (
            <div className="px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[10px] font-bold text-emerald-400">{sub.planName}</span>
              </div>
            </div>
          ) : null
        ) : (
          <Link href="/dashboard/abonelik" className="block px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-all">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-[10px] font-bold text-red-400">Plan Yok</span>
            </div>
            <div className="text-[9px] text-red-300/70 mt-0.5">Yükselt →</div>
          </Link>
        )}
      </div>

      {isSuperAdmin && (
        <div className="mt-auto pt-3 border-t border-white/[0.04]">
          <Link
            href="/admin"
            className="w-full text-left px-2 md:px-3 py-2 md:py-2.5 rounded-xl text-xs font-bold flex items-center justify-center md:justify-start gap-2 md:gap-3 transition-all bg-brand-orange/10 text-brand-orange border border-brand-orange/20 hover:bg-brand-orange/20"
            title="Süperadmin Paneli"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">Süperadmin</span>
          </Link>
        </div>
      )}
    </aside>
  );
}
