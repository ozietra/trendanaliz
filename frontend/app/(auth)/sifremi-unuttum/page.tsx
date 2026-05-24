'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, AlertCircle, Loader2, CheckCircle2, ChevronLeft } from 'lucide-react';
import { api } from '../../../lib/api';

const forgotSchema = z.object({
  email: z.string().email('Lütfen geçerli bir e-posta adresi giriniz.'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotFormValues) => {
    setErrorMsg(null);
    try {
      await api.post('/auth/forgot-password', data);
      setIsSuccess(true);
      reset();
    } catch (err: any) {
      const message = err.response?.data?.message || 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
      setErrorMsg(message);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 border border-emerald-100 mb-2">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-brand-navy">Bağlantı Gönderildi!</h2>
          <p className="text-sm text-brand-gray-dark leading-relaxed max-w-sm mx-auto">
            Şifrenizi güvenle sıfırlamanız için gerekli bağlantıyı e-posta adresinize gönderdik. Lütfen kutunuzu kontrol edin.
          </p>
        </div>
        <div className="pt-4 border-t border-slate-100">
          <Link
            href="/giris"
            className="inline-flex justify-center items-center py-2.5 px-6 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-sm shadow-premium-orange transition-all duration-300 hover-premium"
          >
            Giriş Ekranına Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Geri Butonu */}
      <Link
        href="/giris"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-orange transition-colors self-start"
      >
        <ChevronLeft className="w-4 h-4" />
        Giriş Ekranına Dön
      </Link>

      {/* Başlık */}
      <div className="space-y-2 text-center lg:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-brand-navy">
          Şifrenizi mi Unuttunuz?
        </h2>
        <p className="text-sm text-brand-gray-dark">
          E-posta adresinizi girerek şifre sıfırlama bağlantısını talep edin.
        </p>
      </div>

      {/* Mesaj Bildirimleri */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* E-posta */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-navy-light block">
            E-posta Adresi
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              {...register('email')}
              type="email"
              disabled={isSubmitting}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm bg-white outline-none transition-all ${
                errors.email
                  ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-slate-200 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/30'
              }`}
              placeholder="ornek@firma.com"
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-600 mt-1 font-medium">{errors.email.message}</p>
          )}
        </div>

        {/* Buton */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-sm shadow-premium-orange transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover-premium"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Bağlantı Gönderiliyor...</span>
            </>
          ) : (
            <span>Sıfırlama Bağlantısı Gönder</span>
          )}
        </button>
      </form>
    </div>
  );
}
