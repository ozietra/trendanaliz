'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Settings,
  ScrollText,
  LogOut,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';

const items = [
  { href: '/admin', label: 'Genel Bakış', icon: LayoutDashboard, exact: true },
  { href: '/admin/kullanicilar', label: 'Kullanıcılar', icon: Users },
  { href: '/admin/planlar', label: 'Planlar', icon: Package },
  { href: '/admin/odemeler', label: 'Ödemeler', icon: CreditCard },
  { href: '/admin/ayarlar', label: 'Site Ayarları', icon: Settings },
  { href: '/admin/loglar', label: 'Admin Logları', icon: ScrollText },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    router.replace('/giris');
  };

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-[#070c16] border-r border-white/[0.04] py-5 px-3 sticky top-0 h-screen">
      <Link href="/admin" className="flex items-center gap-2 px-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange to-amber-500 flex items-center justify-center shadow-lg shadow-brand-orange/20">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-black text-white tracking-tight leading-none">
            TrendAnaliz
          </div>
          <div className="text-[9px] font-bold text-brand-orange tracking-widest uppercase mt-0.5">
            Süperadmin
          </div>
        </div>
      </Link>

      <nav className="flex-1 space-y-1">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname?.startsWith(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                active
                  ? 'bg-brand-orange/10 text-brand-orange border border-brand-orange/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/[0.04] pt-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/[0.03]"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Kullanıcı Paneli</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/5"
        >
          <LogOut className="w-4 h-4" />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </aside>
  );
}
