'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';

/**
 * Zustand deposunu istemci tarafındaki localStorage verileriyle
 * hidre etmek için kullanılan sağlayıcı bileşen.
 */
export const HydrationProvider = ({ children }: { children: React.ReactNode }) => {
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    setHydrated();
  }, [setHydrated]);

  if (!isHydrated) {
    // Hidrasyon tamamlanana kadar premium bir yükleniyor ekranı gösterebiliriz
    return (
      <div className="min-h-screen bg-brand-navy flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/80 font-medium text-sm">TrendAnaliz Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
