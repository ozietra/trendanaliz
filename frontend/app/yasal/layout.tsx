import React from 'react';
import Link from 'next/link';

export default function YasalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070c16] text-slate-100">
      <header className="border-b border-white/[0.04] bg-[#0b1424] px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-1.5">
          <span className="text-lg font-black tracking-tight text-white">
            Trend<span className="text-brand-orange">Analiz</span><span className="text-brand-orange">.</span>
          </span>
        </Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <article className="prose prose-invert prose-slate max-w-none prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-a:text-brand-orange">
          {children}
        </article>
        <div className="mt-12 pt-6 border-t border-white/[0.04] text-xs text-slate-500 flex flex-wrap gap-4">
          <Link href="/yasal/kvkk" className="hover:text-brand-orange">KVKK Aydınlatma Metni</Link>
          <Link href="/yasal/gizlilik" className="hover:text-brand-orange">Gizlilik Sözleşmesi</Link>
          <Link href="/yasal/sozlesme" className="hover:text-brand-orange">Kullanım Koşulları</Link>
          <Link href="/" className="hover:text-brand-orange">Ana Sayfa</Link>
        </div>
      </main>
    </div>
  );
}
