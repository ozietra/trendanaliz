'use client';

import React from 'react';
import { Sparkles, Lock } from 'lucide-react';
import Link from 'next/link';

interface ComingSoonProps {
  title: string;
  subtitle?: string;
  description: string;
  features?: string[];
  requiredPlan?: string;
}

export default function ComingSoon({
  title,
  subtitle,
  description,
  features = [],
  requiredPlan,
}: ComingSoonProps) {
  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-[#070c16]">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          {subtitle && (
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
              {subtitle}
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{title}</h1>
        </div>

        <div className="bg-gradient-to-br from-brand-orange/10 to-blue-500/10 border border-white/[0.06] rounded-2xl p-8 sm:p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-orange/20 border border-brand-orange/30 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-brand-orange" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Yakında</h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">{description}</p>

          {features.length > 0 && (
            <ul className="mt-6 space-y-2 max-w-md mx-auto text-left">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-1.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}

          {requiredPlan && (
            <div className="mt-6 inline-flex items-center gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
              <Lock className="w-3 h-3" />
              <span>
                <strong>{requiredPlan}</strong> planı ve üzeri için aktif olacak
              </span>
            </div>
          )}

          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-block px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs"
            >
              Panele Dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
