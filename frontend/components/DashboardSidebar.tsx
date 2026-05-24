'use client';

import React from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';

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

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPERADMIN';

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
