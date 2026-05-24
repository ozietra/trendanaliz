'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { api } from '../../lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('E-posta adresiniz doğrulanıyor...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Geçersiz veya eksik doğrulama bağlantısı. Lütfen e-postanızı kontrol edin.');
      return;
    }

    const verify = async () => {
      try {
        const response = await api.get(`/auth/verify-email/${token}`);
        setStatus('success');
        setMessage(response.data.message || 'E-posta adresiniz başarıyla doğrulandı!');
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.message ||
            'E-posta doğrulama başarısız oldu. Bağlantının süresi dolmuş olabilir.'
        );
      }
    };

    verify();
  }, [token]);

  return (
    <div className="bg-white p-8 rounded-2xl shadow-premium border border-slate-100 text-center space-y-6 max-w-md w-full">
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
          <h2 className="text-xl font-bold text-brand-navy">Doğrulanıyor</h2>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 border border-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-brand-navy">Tebrikler!</h2>
          <p className="text-sm text-brand-gray-dark leading-relaxed">{message}</p>
          <div className="pt-4 w-full">
            <Link
              href="/giris"
              className="w-full inline-flex justify-center items-center py-2.5 px-6 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-sm shadow-premium-orange transition-all duration-300 hover-premium"
            >
              Şimdi Giriş Yapın
            </Link>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center justify-center">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-brand-navy">Doğrulama Başarısız</h2>
          <p className="text-sm text-brand-gray-dark leading-relaxed">{message}</p>
          <div className="pt-4 flex flex-col gap-2 w-full">
            <Link
              href="/giris"
              className="w-full inline-flex justify-center items-center py-2.5 px-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
            >
              Giriş Sayfasına Dön
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-brand-navy-dark relative flex items-center justify-center p-6 overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-brand-orange/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-brand-orange/10 blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group select-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-orange to-brand-orange-light flex items-center justify-center font-bold text-white text-xl shadow-premium-orange transition-transform duration-300 group-hover:scale-105">
            T
          </div>
          <span className="text-2xl font-bold tracking-tight text-white transition-colors duration-300 group-hover:text-brand-orange">
            Trend<span className="text-brand-orange">Analiz</span>
          </span>
        </Link>

        {/* Content wrapped in Suspense for useSearchParams */}
        <Suspense
          fallback={
            <div className="bg-white p-8 rounded-2xl shadow-premium border border-slate-100 text-center space-y-6 max-w-md w-full">
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
                <h2 className="text-xl font-bold text-brand-navy">Doğrulanıyor</h2>
                <p className="text-sm text-slate-500">Yükleniyor...</p>
              </div>
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
