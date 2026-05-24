'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { CreditCard, ShieldCheck, Loader2, Check, ArrowRight, AlertCircle, Building2, Clock, Copy, CheckCircle2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  billingCycle: string;
  features: string[];
  isActive: boolean;
}

type Provider = 'IYZICO' | 'PAYTR' | 'IBAN';

interface PaymentMethodsData {
  methods: string[];
  iban: string | null;
  ibanReceiver: string | null;
}

export default function OdemePage() {
  const params = useParams();
  const router = useRouter();
  const planId = params?.planId as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsData | null>(null);
  // IBAN state
  const [ibanSenderName, setIbanSenderName] = useState('');
  const [ibanSuccess, setIbanSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [plansRes, methodsRes] = await Promise.all([
          api.get('/public/plans'),
          api.get('/public/payment-methods').catch(() => ({ data: { success: false } })),
        ]);

        const found = (plansRes.data?.data || []).find((p: Plan) => p.id === planId || p.slug === planId);
        if (!found) {
          setError('Plan bulunamadı.');
        } else if (!found.isActive) {
          setError('Bu plan şu anda satışa kapalıdır.');
        } else {
          setPlan(found);
        }

        if (methodsRes.data?.success) {
          const data = methodsRes.data.data;
          setPaymentMethods(data);
          // İlk aktif yöntemi seç
          if (data.methods.length > 0) {
            setProvider(data.methods[0] as Provider);
          }
        } else {
          setPaymentMethods({ methods: ['IYZICO', 'PAYTR'], iban: null, ibanReceiver: null });
          setProvider('IYZICO');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Plan yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [planId]);

  const startCheckout = async () => {
    if (!plan || !provider) return;
    setBusy(true);
    setError(null);
    try {
      if (provider === 'IBAN') {
        // IBAN bildirimi
        const res = await api.post('/payments/iban-notify', {
          planId: plan.id,
          senderName: ibanSenderName || undefined,
        });
        if (res.data.success) {
          setIbanSuccess(true);
        }
      } else {
        // Iyzico / PayTR
        const res = await api.post('/payments/checkout', {
          planId: plan.id,
          provider,
        });
        const url = res.data?.data?.paymentPageUrl;
        if (!url) throw new Error('Ödeme sayfası alınamadı');
        window.location.href = url;
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Ödeme başlatılamadı.');
      setBusy(false);
    }
  };

  const copyIban = () => {
    if (paymentMethods?.iban) {
      navigator.clipboard.writeText(paymentMethods.iban);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  // IBAN başarı ekranı
  if (ibanSuccess) {
    return (
      <div className="min-h-screen bg-[#070c16] flex items-center justify-center p-6">
        <div className="bg-[#0b1424] border border-emerald-500/20 rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Clock className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Bildiriminiz Alındı!</h2>
          <p className="text-sm text-slate-300 mb-4 leading-relaxed">
            Havale/EFT ödeme bildiriminiz başarıyla iletildi. Ödemeniz{' '}
            <strong className="text-emerald-400">1-3 saat</strong> içinde kontrol edilip
            onaylanacaktır. Onay sonrası aboneliğiniz otomatik olarak aktifleştirilecektir.
          </p>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-xs text-slate-400 mb-6">
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-bold">E-posta ile bilgilendirileceksiniz</span>
            </div>
            Ödemeniz onaylandığında veya reddedildiğinde bildirim alacaksınız.
          </div>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-lg bg-brand-orange text-white font-bold text-xs"
          >
            Dashboard&apos;a Dön
          </Link>
        </div>
      </div>
    );
  }

  const price = Number(plan.price);
  const availableMethods = paymentMethods?.methods || ['IYZICO', 'PAYTR'];

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
              {availableMethods.includes('IYZICO') && (
                <ProviderOption
                  value="IYZICO"
                  selected={provider === 'IYZICO'}
                  onSelect={setProvider}
                  title="Iyzico"
                  subtitle="Kredi/Banka Kartı · 3D Secure · Taksit"
                  badge="Önerilen"
                />
              )}
              {availableMethods.includes('PAYTR') && (
                <ProviderOption
                  value="PAYTR"
                  selected={provider === 'PAYTR'}
                  onSelect={setProvider}
                  title="PayTR"
                  subtitle="Kredi/Banka Kartı · iFrame · Taksit"
                />
              )}
              {availableMethods.includes('IBAN') && (
                <ProviderOption
                  value="IBAN"
                  selected={provider === 'IBAN'}
                  onSelect={setProvider}
                  title="Havale / EFT"
                  subtitle="IBAN'a transfer · 1-3 saat içinde onaylanır"
                  icon={<Building2 className="w-4 h-4 text-brand-orange" />}
                />
              )}
            </div>

            {/* IBAN bilgi paneli */}
            {provider === 'IBAN' && paymentMethods && (
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 mb-4 space-y-3">
                <div className="text-xs font-bold text-blue-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Havale / EFT Bilgileri
                </div>
                {paymentMethods.iban ? (
                  <>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[10px] text-slate-500 mb-0.5">IBAN</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-white tracking-wide">
                          {paymentMethods.iban}
                        </span>
                        <button
                          onClick={copyIban}
                          className="text-xs text-brand-orange hover:text-brand-orange-light flex items-center gap-1"
                        >
                          {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied ? 'Kopyalandı' : 'Kopyala'}
                        </button>
                      </div>
                    </div>
                    {paymentMethods.ibanReceiver && (
                      <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 mb-0.5">Alıcı</div>
                        <div className="text-sm font-bold text-white">{paymentMethods.ibanReceiver}</div>
                      </div>
                    )}
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[10px] text-slate-500 mb-0.5">Tutar</div>
                      <div className="text-sm font-bold text-white">₺{price.toLocaleString('tr-TR')}</div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Gönderici Ad Soyad (opsiyonel)
                      </label>
                      <input
                        type="text"
                        value={ibanSenderName}
                        onChange={(e) => setIbanSenderName(e.target.value)}
                        placeholder="Hesap sahibinin adı"
                        className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-brand-orange/40 outline-none rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Havale/EFT yaptıktan sonra <strong>&quot;Ödeme Bildir&quot;</strong> butonuna tıklayın.
                        Ödemeniz <strong className="text-amber-400">1-3 saat</strong> içinde kontrol edilip
                        onaylanacaktır.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">IBAN bilgisi henüz ayarlanmamış. Lütfen yöneticiyle iletişime geçin.</p>
                )}
              </div>
            )}

            {provider !== 'IBAN' && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Kart bilgileriniz sunucularımızda <strong>saklanmaz</strong>; doğrudan ödeme
                  sağlayıcısının PCI-DSS sertifikalı altyapısına gönderilir.
                </p>
              </div>
            )}

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
                &apos;nı ve{' '}
                <Link href="/yasal/gizlilik" className="text-brand-orange hover:underline">
                  Gizlilik Sözleşmesi
                </Link>
                &apos;ni okudum, kabul ediyorum.
              </span>
            </label>

            {error && (
              <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-3">
                {error}
              </div>
            )}

            <button
              onClick={startCheckout}
              disabled={busy || !acceptedTerms || !provider}
              className="w-full py-3 rounded-xl bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{provider === 'IBAN' ? 'Bildiriliyor...' : 'Yönlendiriliyor...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {provider === 'IBAN'
                      ? 'Ödeme Bildir'
                      : `₺${price.toLocaleString('tr-TR')} Öde`}
                  </span>
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
  icon,
}: {
  value: Provider;
  selected: boolean;
  onSelect: (v: Provider) => void;
  title: string;
  subtitle: string;
  badge?: string;
  icon?: React.ReactNode;
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
          {icon}
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
