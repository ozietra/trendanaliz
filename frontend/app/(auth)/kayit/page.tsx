'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Lock, Phone, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../../lib/api';

// Zod Doğrulama Şeması (Zod validation)
const registerSchema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalıdır.'),
  email: z.string().email('Lütfen geçerli bir e-posta adresi giriniz.'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır.'),
  phone: z.string().optional().or(z.literal('')),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      phone: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setErrorMsg(null);
    try {
      // Backend'e gönderilecek verileri düzenle (boş teli undefined yap)
      const submitData = {
        ...data,
        phone: data.phone || undefined,
      };

      await api.post('/auth/register', submitData);
      setIsSuccess(true);
      reset();
    } catch (err: any) {
      const message = err.response?.data?.message || 'Kayıt işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.';
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
          <h2 className="text-2xl font-bold text-brand-navy">Harika, Hesabınız Oluşturuldu!</h2>
          <p className="text-sm text-brand-gray-dark leading-relaxed max-w-sm mx-auto">
            Giriş yapabilmeniz için e-posta adresinizi doğrulamanız gerekmektedir. Lütfen gelen kutunuzu (ve gereksiz kutusunu) kontrol edin.
          </p>
        </div>
        <div className="pt-4 border-t border-slate-100">
          <Link
            href="/giris"
            className="inline-flex justify-center items-center py-2.5 px-6 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-sm shadow-premium-orange transition-all duration-300 hover-premium"
          >
            Giriş Ekranına Git
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="space-y-2 text-center lg:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-brand-navy">
          Hemen Kaydolun
        </h2>
        <p className="text-sm text-brand-gray-dark">
          1 günlük deneme süresiyle tüm premium özellikleri test edin.
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
        {/* Ad Soyad */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-navy-light block">
            Ad Soyad / Firma Adı
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <input
              {...register('name')}
              type="text"
              disabled={isSubmitting}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm bg-white outline-none transition-all ${
                errors.name
                  ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-slate-200 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/30'
              }`}
              placeholder="Ahmet Yılmaz"
            />
          </div>
          {errors.name && (
            <p className="text-xs text-red-600 mt-1 font-medium">{errors.name.message}</p>
          )}
        </div>

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

        {/* Telefon Numarası */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-navy-light block">
            Telefon Numarası <span className="text-slate-400 font-normal">(Opsiyonel)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Phone className="w-4 h-4" />
            </div>
            <input
              {...register('phone')}
              type="tel"
              disabled={isSubmitting}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm bg-white outline-none transition-all border-slate-200 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/30`}
              placeholder="05551234567"
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-red-600 mt-1 font-medium">{errors.phone.message}</p>
          )}
        </div>

        {/* Şifre */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-navy-light block">
            Şifre
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              {...register('password')}
              type="password"
              disabled={isSubmitting}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm bg-white outline-none transition-all ${
                errors.password
                  ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-slate-200 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/30'
              }`}
              placeholder="••••••••"
            />
          </div>
          {errors.password && (
            <p className="text-xs text-red-600 mt-1 font-medium">{errors.password.message}</p>
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
              <span>Kaydınız Alınıyor...</span>
            </>
          ) : (
            <span>Hesap Oluştur ve Plan Seç</span>
          )}
        </button>
      </form>

      {/* Giriş Linki */}
      <div className="text-center text-sm text-slate-500">
        Zaten hesabınız var mı?{' '}
        <Link
          href="/giris"
          className="font-bold text-brand-orange hover:text-brand-orange-hover transition-colors"
        >
          Giriş Yapın
        </Link>
      </div>
    </div>
  );
}
