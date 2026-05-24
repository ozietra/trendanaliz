'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../../../lib/api';

// Zod Doğrulama Şeması (Şifrelerin eşleşmesi kontrol edilir)
const resetSchema = z
  .object({
    password: z.string().min(6, 'Yeni şifre en az 6 karakter olmalıdır.'),
    confirmPassword: z.string().min(1, 'Lütfen şifrenizi tekrar girin.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Şifreler eşleşmiyor.',
    path: ['confirmPassword'],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetFormValues) => {
    setErrorMsg(null);
    try {
      await api.post(`/auth/reset-password/${token}`, {
        password: data.password,
      });
      setIsSuccess(true);
      reset();
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.';
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
          <h2 className="text-2xl font-bold text-brand-navy">Şifreniz Güncellendi!</h2>
          <p className="text-sm text-brand-gray-dark leading-relaxed max-w-sm mx-auto">
            Yeni şifreniz başarıyla kaydedildi. Artık bu şifreyle güvenle giriş yapabilirsiniz.
          </p>
        </div>
        <div className="pt-4 border-t border-slate-100">
          <Link
            href="/giris"
            className="inline-flex justify-center items-center py-2.5 px-6 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-sm shadow-premium-orange transition-all duration-300 hover-premium"
          >
            Giriş Yap
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
          Yeni Şifre Belirleyin
        </h2>
        <p className="text-sm text-brand-gray-dark">
          Güvenliğiniz için güçlü ve benzersiz bir şifre girin.
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
        {/* Şifre */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-navy-light block">
            Yeni Şifre
          </label>
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

        {/* Şifre Onay */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-navy-light block">
            Şifreyi Tekrar Girin
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              {...register('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              disabled={isSubmitting}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm bg-white outline-none transition-all ${
                errors.confirmPassword
                  ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-slate-200 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/30'
              }`}
              placeholder="••••••••"
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-red-600 mt-1 font-medium">{errors.confirmPassword.message}</p>
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
              <span>Şifre Güncelleniyor...</span>
            </>
          ) : (
            <span>Şifreyi Sıfırla ve Kaydet</span>
          )}
        </button>
      </form>
    </div>
  );
}
