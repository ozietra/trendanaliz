'use client';

import React, { useEffect, useState } from 'react';
import DashboardSidebar from '../../../components/DashboardSidebar';
import { api } from '../../../lib/api';
import Link from 'next/link';
import { Loader2, CreditCard, Calendar, CheckCircle2, XCircle, Sparkles, Check, ArrowRight } from 'lucide-react';

interface Subscription {
  id: string;
  status: string;
  autoRenew: boolean;
  startDate: string;
  endDate: string;
  plan?: {
    name: string;
    slug: string;
    price: string;
    currency: string;
    billingCycle: string;
  };
  payments?: Array<{
    id: string;
    amount: string;
    status: string;
    method: string;
    createdAt: string;
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ödeme Bekleniyor',
  ACTIVE: 'Aktif',
  EXPIRED: 'Süresi Dolmuş',
  CANCELED: 'İptal Edilmiş',
  PENDING_PAYMENT: 'Ödeme Bekliyor',
};

export default function AbonelikPage() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/subscriptions/me');
      setSub(res.data?.data || null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Abonelik bilgisi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cancel = async () => {
    if (!confirm('Aboneliğiniz yenileme tarihinde sonlandırılacak. Devam edilsin mi?')) return;
    setBusy(true);
    try {
      await api.post('/subscriptions/cancel');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'İptal başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#070c16]">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
            Faturalandırma
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Aboneliğim
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
        ) : !sub ? (
          <PlanPicker />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Plan kartı */}
            <div className="lg:col-span-2 bg-[#0b1424] border border-white/[0.04] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-brand-orange" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">{sub.plan?.name || '-'}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {STATUS_LABEL[sub.status] || sub.status}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-2xl font-black text-white">
                    ₺{Number(sub.plan?.price || 0).toLocaleString('tr-TR')}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase">
                    / {sub.plan?.billingCycle === 'YEARLY' ? 'yıl' : 'ay'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                <InfoBox
                  icon={<Calendar className="w-4 h-4" />}
                  label="Başlangıç"
                  value={new Date(sub.startDate).toLocaleDateString('tr-TR')}
                />
                <InfoBox
                  icon={<Calendar className="w-4 h-4" />}
                  label={'Yenileme Tarihi'}
                  value={new Date(sub.endDate).toLocaleDateString('tr-TR')}
                />
                <InfoBox
                  icon={
                    sub.autoRenew ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )
                  }
                  label="Otomatik Yenileme"
                  value={sub.autoRenew ? 'Açık' : 'Kapalı (sonlanacak)'}
                />
                <InfoBox
                  icon={<CreditCard className="w-4 h-4" />}
                  label="Plan"
                  value={sub.plan?.slug || '-'}
                />
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.04] flex flex-wrap gap-2">
                <Link
                  href={`/odeme/${sub.plan?.slug || ''}`}
                  className="px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-xs inline-flex items-center gap-2"
                >
                  Plan Yükselt / Yenile
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                {sub.autoRenew && sub.status !== 'CANCELLED' && (
                  <button
                    onClick={cancel}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold text-xs disabled:opacity-50"
                  >
                    {busy ? 'İşleniyor...' : 'Aboneliği İptal Et'}
                  </button>
                )}
                <p className="basis-full text-[10px] text-slate-500 mt-1">
                  İptal sonrası mevcut dönem sonuna kadar hizmet aktif kalır.
                </p>
              </div>
            </div>

            {/* Ödeme geçmişi */}
            <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                Son Ödemeler
              </h3>
              {!sub.payments || sub.payments.length === 0 ? (
                <p className="text-xs text-slate-500">Henüz ödeme kaydı yok.</p>
              ) : (
                <ul className="space-y-2">
                  {sub.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between text-xs py-2 border-b border-white/[0.04] last:border-b-0"
                    >
                      <div>
                        <div className="text-white font-bold">
                          ₺{Number(p.amount).toLocaleString('tr-TR')}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString('tr-TR')} · {p.method}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          p.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : p.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

interface PlanLite {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  billingCycle: string;
  isPopular: boolean;
  features: string[];
}

function PlanPicker() {
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/public/plans');
        setPlans(res.data?.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-8 text-center">
        <Loader2 className="w-6 h-6 text-brand-orange animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div>
      <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-6 mb-4 text-center">
        <Sparkles className="w-10 h-10 text-brand-orange mx-auto mb-2" />
        <h2 className="text-lg font-black text-white mb-1">Aktif Aboneliğiniz Yok</h2>
        <p className="text-sm text-slate-400">
          Aşağıdaki paketlerden birini seçerek hemen başlayabilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`bg-[#0b1424] border rounded-2xl p-5 flex flex-col ${
              p.isPopular ? 'border-brand-orange/40' : 'border-white/[0.04]'
            }`}
          >
            {p.isPopular && (
              <span className="self-start text-[9px] font-bold uppercase bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded mb-2">
                En Popüler
              </span>
            )}
            <h3 className="text-lg font-black text-white">{p.name}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-1 mb-3">
              {p.description}
            </p>
            <div className="flex items-baseline gap-1 mb-3 pb-3 border-b border-white/[0.04]">
              <span className="text-2xl font-black text-white">
                ₺{Number(p.price).toLocaleString('tr-TR')}
              </span>
              <span className="text-[10px] text-slate-500">
                / {p.billingCycle === 'YEARLY' ? 'yıl' : 'ay'}
              </span>
            </div>
            <ul className="space-y-1.5 mb-4 flex-1">
              {(p.features || []).slice(0, 5).map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-300">
                  <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/odeme/${p.slug}`}
              className={`w-full inline-flex items-center justify-center gap-1 py-2.5 rounded-lg font-bold text-xs ${
                p.isPopular
                  ? 'bg-brand-orange hover:bg-brand-orange-hover text-white'
                  : 'bg-white/5 hover:bg-white/10 text-white'
              }`}
            >
              Seç
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 flex items-start gap-2">
      <div className="text-slate-400 mt-0.5">{icon}</div>
      <div>
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
          {label}
        </div>
        <div className="text-xs text-white font-semibold">{value}</div>
      </div>
    </div>
  );
}
