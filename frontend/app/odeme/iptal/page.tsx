'use client';

import React from 'react';
import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function OdemeIptalPage() {
  return (
    <div className="min-h-screen bg-[#070c16] flex items-center justify-center p-6">
      <div className="bg-[#0b1424] border border-white/[0.04] rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Ödeme İptal Edildi</h2>
        <p className="text-sm text-slate-300 mb-6">
          Ödeme tamamlanmadı. Aboneliğinizde herhangi bir değişiklik olmadı.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard/abonelik"
            className="px-5 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-xs"
          >
            Tekrar Dene
          </Link>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs"
          >
            Panele Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
