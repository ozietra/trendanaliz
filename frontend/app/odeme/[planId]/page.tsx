'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { CreditCard, ShieldCheck, Loader2, Check, ArrowRight, AlertCircle } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  billingCycle: string;
  features: string[];
}

type Provider = 'IYZICO' | 'PAYTR';

export default function OdemePage() {
  const params = useParams();
  const router = useRouter();
  const planId = params?.planId as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>('IYZICO');
  const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/public/plans');
        const found = (res.data?.data || []).find((p: Plan) => p.id === planId || p.slug === planId);
        if (!found) {
          setError('Plan bulunamadı.');
        } else {
          setPlan(found);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Plan yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [planId]);

  const startCheckout = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/payments/checkout', {
        planId: plan.id,
        provider,
      });
      const url = res.data?.data?.paymentPageUrl;
      if (!url) throw new Error('Ödeme sayfası alınamadı');
      // Aynı pencerede sağlayıcıya yönlendir
      window.location.href = url;
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Ödeme başlatılamadı.');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070c16] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[#070c16] flex items-center justify-center p-6">
        <div className="bg-[#0b1424] border border-white/[0.04] rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-black text-white mb-2">Hata</h2>
          <p className="text-sm text-slate-300 mb-6">{error || 'Plan bulunamadı.'}</p>
          <Link
            href="/dashboard/abonelik"
            className="inline-block px-5 py-2.5 rounded-lg bg-brand-orange text-white font-bold text-xs"
          >
            Aboneliğe Dön
          </Link>
        </div>
      </div>
    );
  }

  const price = Number(plan.price);

  return (
    <div className="min-h-screen bg-[#070c16] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard/abonelik"
          className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 mb-6"
        >
          ← Geri Dön
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan özeti */}
          <div className="bg-[#0b1424] border border-white/[0.04] rounded-2xl p-6">
            <div className="text-[9px] font-bold uppercase tracking-widest text-brand-orange mb-2">
              Seçilen Plan
            </div>
            <h2 className="text-2xl font-black text-white mb-1">{plan.name}</h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">{plan.description}</p>

            <div className="flex items-baseline gap-1 mb-4 pb-4 border-b border-white/[0.04]">
              <span className="text-3xl font-black text-white">
                ₺{price.toLocaleString('tr-TR')}
              </span>
              <span className="text-xs text-slate-500">
                / {plan.billingCycle === 'YEARLY' ? 'yıl' : 'ay'}
              </span>
            </div>

            <ul className="space-y-2">
              {(plan.features || []).map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Ödeme yöntemi seçimi */}
          <div className="bg-[#0b1424] border border-white/[0.04] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand-orange" />
              Ödeme Yöntemi
            </h3>

            <div className="space-y-2 mb-5">
              <ProviderOption
                value="IYZICO"
                selected={provider === 'IYZICO'}
                onSelect={setProvider}
                title="Iyzico"
                subtitle="Kredi/Banka Kartı · 3D Secure · Taksit"
                badge="Önerilen"
              />
              <ProviderOption
                value="PAYTR"
                selected={provider === 'PAYTR'}
                onSelect={setProvider}
                title="PayTR"
                subtitle="Kredi/Banka Kartı · iFrame · Taksit"
              />
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Kart bilgileriniz sunucularımızda <strong>saklanmaz</strong>; doğrudan ödeme
                sağlayıcısının PCI-DSS sertifikalı altyapısına gönderilir.
              </p>
            </div>

            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-brand-orange"
              />
              <span className="text-[11px] text-slate-400 leading-relaxed">
                <Link href="/yasal/sozlesme" className="text-brand-orange hover:underline">
                  Kullanım Koşulları
                </Link>
                'nı ve{' '}
                <Link href="/yasal/gizlilik" className="text-brand-orange hover:underline">
                  Gizlilik Sözleşmesi
                </Link>
                'ni okudum, kabul ediyorum.
              </span>
            </label>

            {error && (
              <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-3">
                {error}
              </div>
            )}

            <button
              onClick={startCheckout}
              disabled={busy || !acceptedTerms}
              className="w-full py-3 rounded-xl bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Yönlendiriliyor...</span>
                </>
              ) : (
                <>
                  <span>₺{price.toLocaleString('tr-TR')} Öde</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderOption({
  value,
  selected,
  onSelect,
  title,
  subtitle,
  badge,
}: {
  value: Provider;
  selected: boolean;
  onSelect: (v: Provider) => void;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all ${
        selected
          ? 'border-brand-orange/40 bg-brand-orange/[0.05]'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
          selected ? 'border-brand-orange' : 'border-slate-500'
        }`}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-brand-orange" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{title}</span>
          {badge && (
            <span className="text-[9px] font-bold uppercase bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-400">{subtitle}</div>
      </div>
    </button>
  );
}
