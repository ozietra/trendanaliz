'use client';

import React, { useEffect, useState } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import { Loader2, Sliders, Power } from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  type: string;
  limit: number;
  step: number;
  minMargin: number;
  activeCount: number;
  isActive: boolean;
}

export default function FiyatKurallariPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rules');
      setRules(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kurallar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (rule: Rule) => {
    try {
      await api.put(`/rules/${rule.id}/toggle`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Durum değişmedi.');
    }
  };

  const deleteRule = async (rule: Rule) => {
    if (!confirm(`"${rule.name}" stratejisini silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/rules/${rule.id}`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Silme başarısız.');
    }
  };

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
            Otomatik Fiyatlandırma
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Fiyat Kuralları
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Repricer&apos;ın hangi stratejiyle çalışacağını belirleyin.
          </p>
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
        ) : rules.length === 0 ? (
          <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-8 text-center">
            <Sliders className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 text-sm font-semibold mb-1">Henüz fiyatlandırma kuralı tanımlanmadı</div>
            <div className="text-slate-500 text-xs">
              Mağazanızda otomatik fiyat değişikliği yapılmayacaktır. Ana panelden yeni kural ekleyebilirsiniz.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.map((r) => (
              <div
                key={r.id}
                className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-5 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center">
                    <Sliders className="w-4 h-4 text-brand-orange" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-black text-white">{r.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{r.type}</div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs mb-4">
                  <Row label="Aktif Ürün" value={`${r.activeCount} adet`} />
                  <Row label="Adım" value={`₺${r.step.toFixed(2)}`} />
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => toggle(r)}
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                      r.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {r.isActive ? 'Devre Dışı Bırak' : 'Etkinleştir'}
                  </button>
                  <button
                    onClick={() => deleteRule(r)}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}
