'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/auth.store';
import {
  User,
  LogOut,
  Bell,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '../../lib/useNotifications';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated, clearAuth } = useAuthStore();
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Gerçek bildirimler + SSE
  const {
    items: notifications,
    unreadCount,
    connected: sseConnected,
    markAllAsRead,
    markAsRead,
  } = useNotifications();

  const handleMarkAllRead = () => {
    void markAllAsRead();
  };


  // Hidrasyon tamamlandığında oturum yoksa girişe yönlendir.
  // "Demo Mode" davranışı kaldırıldı — oturumsuz dashboard'a erişim yok.
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace('/giris');
    }
  }, [isHydrated, isAuthenticated, router]);

  const handleLogout = () => {
    clearAuth();
    router.push('/giris');
  };

  // Hidrasyon beklerken veya yönlendirme yapılırken spinner göster.
  // isAuthenticated false ise yukarıdaki useEffect /giris'e yönlendirir;
  // bu render yalnızca o kısa "flash" anında çalışır.
  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070c16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium text-xs">Oturum Doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  const displayName = user?.name || 'Değerli Satıcı';
  const displayEmail = user?.email || '';

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#070c16] text-slate-100 flex flex-col font-sans antialiased">
      
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-white/[0.04] bg-[#0b1424] px-4 sm:px-6 flex items-center justify-between shrink-0 relative z-30 select-none">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 group">
            <span className="text-lg font-black tracking-tight text-white group-hover:text-brand-orange transition-colors">
              Trend<span className="text-brand-orange">Analiz</span><span className="text-brand-orange">.</span>
            </span>
          </Link>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-4">

          {/* Notifications Capsule */}
          <div className="relative">
            <button 
              onClick={() => {
                setNotifDropdownOpen(!notifDropdownOpen);
                setUserDropdownOpen(false);
              }}
              className="w-9 h-9 rounded-lg border border-white/[0.04] bg-white/[0.02] flex items-center justify-center hover:bg-white/5 transition-all relative text-slate-300 hover:text-white"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-brand-orange text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#0b1424] p-3 shadow-2xl z-50 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-white/[0.05] pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Bildirimler</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        sseConnected ? 'bg-emerald-400' : 'bg-slate-500'
                      }`}
                      title={sseConnected ? 'Canlı bağlı' : 'Bağlantı bekleniyor'}
                    />
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[9px] text-brand-orange hover:text-brand-orange-hover font-semibold transition-colors cursor-pointer"
                    >
                      Tümünü Oku
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-center text-[11px] text-slate-500 py-6">
                      Henüz bildirim yok.
                    </p>
                  ) : (
                    notifications.map((notif) => {
                      const isWarning =
                        notif.type === 'WARNING' || notif.type === 'ERROR';
                      const titleColor =
                        notif.type === 'ERROR'
                          ? 'text-red-400'
                          : notif.type === 'WARNING'
                          ? 'text-brand-orange'
                          : notif.type === 'SUCCESS'
                          ? 'text-emerald-400'
                          : 'text-blue-400';
                      const time = new Date(notif.createdAt).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <button
                          key={notif.id}
                          onClick={() => {
                            if (!notif.isRead) void markAsRead(notif.id);
                            if (notif.linkUrl) {
                              setNotifDropdownOpen(false);
                              router.push(notif.linkUrl);
                            }
                          }}
                          className={`w-full text-left p-2 rounded-lg transition-colors border ${
                            !notif.isRead
                              ? 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
                              : 'bg-transparent border-transparent opacity-60'
                          }`}
                        >
                          <div className="flex justify-between font-bold mb-0.5 text-[10px]">
                            <span className={titleColor}>{notif.title}</span>
                            <span className="text-slate-500 font-mono text-[8px]">{time}</span>
                          </div>
                          <p className="text-slate-400 text-[10px] leading-relaxed">
                            {notif.message}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button 
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setNotifDropdownOpen(false);
              }}
              className="flex items-center gap-2 p-1 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/5 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-orange to-blue-500 p-[1px] shrink-0">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              </div>
              <div className="hidden sm:block pr-1 select-none">
                <div className="text-[10px] font-bold text-white leading-tight truncate max-w-[100px]">{displayName}</div>
                <div className="text-[8px] text-slate-400 leading-tight">Müşteri Paneli</div>
              </div>
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/[0.08] bg-[#0b1424] py-1.5 shadow-2xl z-50 animate-fadeIn">
                <div className="px-4 py-2 border-b border-white/[0.04]">
                  <p className="text-[10px] text-slate-400 leading-tight">Giriş Yapılan Hesap</p>
                  <p className="text-xs font-bold text-white leading-tight truncate mt-0.5">{displayEmail}</p>
                </div>
                
                <div className="py-1">
                  <Link
                    href="/dashboard/abonelik"
                    className="w-full text-left px-4 py-2 text-[10px] text-brand-orange hover:bg-white/5 font-bold flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Aboneliğim</span>
                  </Link>
                </div>

                <div className="border-t border-white/[0.04] py-1">
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-[10px] text-red-400 hover:bg-white/5 font-bold flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Çıkış Yap</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Body Layout (Sidebar + Interactive Workspace) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Render child pages */}
        {children}
      </div>

    </div>
  );
}
