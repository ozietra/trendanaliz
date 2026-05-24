'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../store/auth.store';

// Zod Doğrulama Şeması (Zod validation)
const loginSchema = z.object({
  email: z.string().email('Lütfen geçerli bir e-posta adresi giriniz.'),
  password: z.string().min(1, 'Şifre alanı boş bırakılamaz.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await api.post('/auth/login', data);
      const { user, accessToken, refreshToken } = response.data.data;
      
      setAuth(user, accessToken, refreshToken);
      setSuccessMsg('Giriş başarılı! Yönlendiriliyorsunuz...');
      
      // 1.5 saniye sonra dashboard'a yönlendir
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Giriş yapılırken bir hata oluştu. Bilgilerinizi kontrol edin.';
      setErrorMsg(message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="space-y-2 text-center lg:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-brand-navy">
          Hesabınıza Giriş Yapın
        </h2>
        <p className="text-sm text-brand-gray-dark">
          TrendAnaliz panelinize erişmek için e-posta ve şifrenizi girin.
        </p>
      </div>

      {/* Mesaj Bildirimleri */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-100 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
          <span>{successMsg}</span>
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

        {/* Şifre */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-brand-navy-light block">
              Şifre
            </label>
            <Link
              href="/sifremi-unuttum"
              className="text-xs font-medium text-brand-orange hover:text-brand-orange-hover"
            >
              Şifremi Unuttum?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              disabled={isSubmitting}
              className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm bg-white outline-none transition-all ${
                errors.password
                  ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-slate-200 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/30'
              }`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
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
              <span>Giriş Yapılıyor...</span>
            </>
          ) : (
            <span>Giriş Yap</span>
          )}
        </button>
      </form>

      {/* Kaydol Linki */}
      <div className="text-center text-sm text-slate-500">
        Hesabınız yok mu?{' '}
        <Link
          href="/kayit"
          className="font-bold text-brand-orange hover:text-brand-orange-hover transition-colors"
        >
          Ücretsiz Kaydolun
        </Link>
      </div>
    </div>
  );
}
