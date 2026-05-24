'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

function SuccessContent() {
  const search = useSearchParams();
  const router = useRouter();
  const paymentId = search.get('paymentId');
  const isMock = search.get('mock') === '1';

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Ödemeniz doğrulanıyor...');

  useEffect(() => {
    if (!paymentId) {
      setStatus('error');
      setMessage('Ödeme kimliği bulunamadı.');
      return;
    }

    (async () => {
      try {
        // MOCK akışta webhook çağrılmaz, frontend mock-success endpoint'ini tetikler
        if (isMock) {
          await api.post(`/payments/${paymentId}/mock-success`);
        }

        // Durumu sorgula
        const res = await api.get(`/payments/${paymentId}`);
        const p = res.data?.data;
        if (p?.status === 'COMPLETED') {
          setStatus('success');
          setMessage(`Aboneliğiniz aktif edildi. (${p.subscription?.plan?.name || ''})`);
        } else if (p?.status === 'PENDING') {
          // Webhook henüz gelmemiş olabilir, kısa bekleyip tekrar dene
          setTimeout(async () => {
            const r2 = await api.get(`/payments/${paymentId}`);
            if (r2.data?.data?.status === 'COMPLETED') {
              setStatus('success');
              setMessage('Aboneliğiniz aktif edildi.');
            } else {
              setStatus('error');
              setMessage('Ödeme doğrulanamadı. Lütfen aboneliğinizi kontrol edin.');
            }
          }, 2500);
        } else {
          setStatus('error');
          setMessage('Ödeme başarısız veya beklemede.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Ödeme durumu sorgulanamadı.');
      }
    })();
  }, [paymentId, isMock]);

  return (
    <div className="bg-[#0b1424] border border-white/[0.04] rounded-2xl p-8 max-w-md w-full text-center">
      {status === 'verifying' && (
        <>
          <Loader2 className="w-12 h-12 text-brand-orange animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-black text-white mb-2">Doğrulanıyor</h2>
          <p className="text-sm text-slate-400">{message}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Ödeme Başarılı!</h2>
          <p className="text-sm text-slate-300 mb-6">{message}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push('/dashboard/abonelik')}
              className="px-5 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-xs"
            >
              Aboneliğimi Gör
            </button>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs"
            >
              Panele Dön
            </Link>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-black text-white mb-2">Sorun Oluştu</h2>
          <p className="text-sm text-slate-300 mb-6">{message}</p>
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard/abonelik"
              className="px-5 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-xs"
            >
              Aboneliğimi Kontrol Et
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function OdemeBasariliPage() {
  return (
    <div className="min-h-screen bg-[#070c16] flex items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="bg-[#0b1424] border border-white/[0.04] rounded-2xl p-8 max-w-md w-full text-center">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin mx-auto" />
          </div>
        }
      >
        <SuccessContent />
      </Suspense>
    </div>
  );
}
