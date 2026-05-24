import React from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-brand-gray overflow-hidden">
      {/* Sol Panel: Premium Marka Tanıtımı (Sadece masaüstü) */}
      <div className="hidden lg:flex lg:col-span-5 bg-brand-navy-dark relative flex-col justify-between p-12 overflow-hidden select-none">
        {/* Glow Arka Plan Efektleri */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-brand-orange/20 blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-brand-orange/10 blur-[80px] pointer-events-none"></div>

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-orange to-brand-orange-light flex items-center justify-center text-white shadow-premium-orange transition-transform duration-300 group-hover:scale-105 animate-fadeIn">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white transition-colors duration-300 group-hover:text-brand-orange">
              Trend<span className="text-brand-orange">Analiz</span>
            </span>
          </Link>
        </div>

        {/* İçerik */}
        <div className="relative z-10 my-auto flex flex-col gap-6 max-w-sm">
          <div className="inline-flex self-start px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-brand-orange/10 text-brand-orange border border-brand-orange/25">
            Satıcı Otomasyonu & Analiz
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            Trendyol'da Rekabeti Siz Belirleyin
          </h1>
          <p className="text-sm leading-relaxed text-white/70">
            Rakiplerinizin fiyat hareketlerini anlık takip edin, BuyBox'ı kaybetmeyin, listinglerinizi optimize edin ve yapay zeka destekli tahminlerle stoksuz kalmayın.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-white/40 font-medium">
          TrendAnaliz © 2026. Tüm hakları saklıdır.
        </div>
      </div>

      {/* Sağ Panel: Auth Form Alanı */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 md:p-12 lg:p-16 relative">
        {/* Mobil Logo ve Header */}
        <div className="lg:hidden absolute top-6 left-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center text-white">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold text-brand-navy">
              Trend<span className="text-brand-orange">Analiz</span>
            </span>
          </Link>
        </div>

        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}

