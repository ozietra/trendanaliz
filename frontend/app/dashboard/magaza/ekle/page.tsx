'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardSidebar from '../../../../components/DashboardSidebar';
import { api } from '../../../../lib/api';
import {
  Store,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

type Step = 1 | 2 | 3;

export default function MagazaEklePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    storeName: '',
    supplierId: '',
    apiKey: '',
    apiSecret: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');

  const handleChange = (k: keyof typeof form, v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  const testConnection = async () => {
    setBusy(true);
    setError(null);
    setTestResult('idle');
    try {
      const res = await api.post('/store/test-connection', {
        supplierId: form.supplierId,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret,
      });
      if (res.data?.success) {
        setTestResult('ok');
        setStep(2);
      } else {
        setTestResult('fail');
        setError(res.data?.message || 'Bağlantı doğrulanamadı.');
      }
    } catch (err: any) {
      setTestResult('fail');
      setError(err.response?.data?.message || 'Bağlantı testi başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const integrate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/store/integrate', form);
      if (res.data?.success) {
        setStep(3);
      } else {
        setError(res.data?.message || 'Entegrasyon başarısız.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Entegrasyon başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto bg-[#070c16]">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
              Trendyol Entegrasyonu
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Yeni Mağaza Ekle
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              3 adımda Trendyol satıcı panelinizi TrendAnaliz&apos;e bağlayın.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step >= s
                      ? 'bg-brand-orange text-white'
                      : 'bg-white/5 text-slate-500 border border-white/10'
                  }`}
                >
                  {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-0.5 ${step > s ? 'bg-brand-orange' : 'bg-white/10'}`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="bg-[#0b1424] border border-white/[0.04] rounded-2xl p-6 sm:p-8">
            {step === 1 && (
              <div className="space-y-5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    API anahtarlarınız sunucularımızda <strong>AES-256-GCM</strong> ile
                    şifrelenir. Trendyol API&apos;si dışında hiçbir 3. tarafla paylaşılmaz.
                  </p>
                </div>

                <Field
                  label="Mağaza Adı"
                  value={form.storeName}
                  onChange={(v) => handleChange('storeName', v)}
                  placeholder="Örn: TrendMağaza"
                  icon={<Store className="w-4 h-4" />}
                />
                <Field
                  label="Supplier ID"
                  value={form.supplierId}
                  onChange={(v) => handleChange('supplierId', v)}
                  placeholder="Örn: 123456"
                  icon={<KeyRound className="w-4 h-4" />}
                />
                <Field
                  label="API Key"
                  value={form.apiKey}
                  onChange={(v) => handleChange('apiKey', v)}
                  placeholder="Trendyol panelinden alınan API Key"
                />
                <Field
                  label="API Secret"
                  value={form.apiSecret}
                  onChange={(v) => handleChange('apiSecret', v)}
                  placeholder="API Secret"
                  type="password"
                />

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {testResult === 'ok' && (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Bağlantı başarılı, sonraki adıma geçilebilir.</span>
                  </div>
                )}

                <button
                  onClick={testConnection}
                  disabled={
                    busy ||
                    !form.storeName ||
                    !form.supplierId ||
                    !form.apiKey ||
                    !form.apiSecret
                  }
                  className="w-full py-3 rounded-xl bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Test ediliyor...</span>
                    </>
                  ) : (
                    <>
                      <span>Bağlantıyı Test Et</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Bağlantı doğrulandı. Aşağıdaki bilgilerle <strong>{form.storeName}</strong>{' '}
                    mağazanız sisteme dahil edilecek ve ürün senkronizasyonu başlayacak.
                  </p>
                </div>

                <SummaryRow label="Mağaza Adı" value={form.storeName} />
                <SummaryRow label="Supplier ID" value={form.supplierId} />
                <SummaryRow label="API Key" value={maskKey(form.apiKey)} />
                <SummaryRow label="API Secret" value={maskKey(form.apiSecret)} />

                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Onayladığınızda ürünler Trendyol panelinden çekilir, repricer otomatik olarak
                    aboneliğinize uygun aralıkta çalışmaya başlar.
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs"
                  >
                    Geri
                  </button>
                  <button
                    onClick={integrate}
                    disabled={busy}
                    className="flex-1 py-3 rounded-xl bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Entegrasyon yapılıyor...</span>
                      </>
                    ) : (
                      <>
                        <span>Entegrasyonu Tamamla</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-black text-white mb-2">Tebrikler!</h2>
                <p className="text-sm text-slate-400 mb-6">
                  Mağazanız başarıyla entegre edildi. Ürünleriniz çekiliyor ve repricer devrede.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => router.push('/dashboard/urunlerim')}
                    className="px-6 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-xs"
                  >
                    Ürünlerime Git
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs"
                  >
                    Panele Dön
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function maskKey(s: string) {
  if (!s) return '';
  if (s.length <= 6) return '••••';
  return s.slice(0, 3) + '••••••' + s.slice(-3);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
      <span className="text-[11px] text-slate-400 font-semibold">{label}</span>
      <span className="text-xs text-white font-mono">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-white/[0.02] border border-white/[0.06] focus:border-brand-orange/40 outline-none rounded-lg py-2.5 pr-3 ${
            icon ? 'pl-10' : 'pl-3'
          } text-xs text-white placeholder-slate-600`}
        />
      </div>
    </div>
  );
}
