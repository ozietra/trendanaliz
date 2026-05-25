'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Loader2,
  Save,
  Bell,
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Send,
} from 'lucide-react';

type Channel = 'IN_APP' | 'EMAIL' | 'SMS' | 'TELEGRAM';

interface PrefsResponse {
  events: string[];
  channels: Channel[];
  prefs: Record<string, Channel[]>;
}

const EVENT_LABELS: Record<string, { title: string; description: string }> = {
  PRICE_ALERT: {
    title: 'Fiyat Uyarısı',
    description: 'Bir ürün minimum fiyat sınırına ulaştığında.',
  },
  BUYBOX_LOST: {
    title: 'BuyBox Kaybı',
    description: 'BuyBox kutusunu rakibe kaptırdığınızda.',
  },
  BUYBOX_WON: {
    title: 'BuyBox Kazanımı',
    description: 'Daha önce kaybettiğiniz BuyBox sıralamasını tekrar ele geçirdiğinizde.',
  },
  STOCK_LOW: {
    title: 'Stok Düşük',
    description: 'Ürün stoğunuz kritik seviyenin altına indiğinde.',
  },
  NEW_ORDER: {
    title: 'Yeni Sipariş',
    description: 'Trendyol mağazanızda yeni bir sipariş oluştuğunda.',
  },
  ORDER_CANCELLED: {
    title: 'Sipariş İptali',
    description: 'Bir siparişin iptal edildiği bildirildiğinde.',
  },
  SUBSCRIPTION_EXPIRING: {
    title: 'Abonelik Sona Eriyor',
    description: 'Aboneliğinizin bitmesine 3 gün kaldığında.',
  },
  SUBSCRIPTION_EXPIRED: {
    title: 'Abonelik Sona Erdi',
    description: 'Aboneliğiniz sona erdiğinde.',
  },
  PAYMENT_SUCCESS: {
    title: 'Ödeme Başarılı',
    description: 'Bir ödeme başarıyla işlendiğinde.',
  },
  PAYMENT_FAILED: {
    title: 'Ödeme Başarısız',
    description: 'Bir ödeme işlemi reddedildiğinde.',
  },
  SYSTEM: {
    title: 'Sistem Bildirimleri',
    description: 'Bakım, duyuru ve genel sistem bildirimleri.',
  },
};

const CHANNEL_META: Record<
  Channel,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  IN_APP: { label: 'Uygulama', icon: Bell },
  EMAIL: { label: 'E-posta', icon: Mail },
  SMS: { label: 'SMS', icon: MessageSquare },
  TELEGRAM: { label: 'Telegram', icon: Send },
};

export default function NotificationPreferences() {
  const [data, setData] = useState<PrefsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramLink, setTelegramLink] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/notifications/preferences');
        setData(res.data?.data || null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Tercihler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
    // Telegram bağlantı durumunu kontrol et
    api.get('/auth/me').then((res) => {
      const user = res.data?.data;
      if (user?.telegramChatId) setTelegramConnected(true);
      if (user?.id) setTelegramLink(`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'trendanalizbildirim_bot'}?start=${user.id}`);
    }).catch(() => {});
  }, []);

  const toggle = (event: string, channel: Channel) => {
    if (!data) return;
    const current = data.prefs[event] || [];
    const next = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    setData({ ...data, prefs: { ...data.prefs, [event]: next } });
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.put('/notifications/preferences', { prefs: data.prefs });
      setSuccess('Bildirim tercihleriniz kaydedildi.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kaydetme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-8 text-center">
        <Loader2 className="w-5 h-5 text-brand-orange animate-spin mx-auto" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4 text-center text-xs text-slate-400">
        Tercihler yüklenemedi.
      </div>
    );
  }

  return (
    <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
      <header className="px-4 py-3 border-b border-white/[0.04] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">Bildirim Tercihleri</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Hangi olaylar için hangi kanallardan bildirim almak istediğinizi seçin.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Kaydet
        </button>
      </header>

      {error && (
        <div className="m-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="m-3 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{success}</span>
        </div>
      )}

      {/*
        E-posta ve SMS sağlayıcı entegrasyonu üretimde aktif edilene kadar,
        kanal seçimi UI'sı sadeleştirildi. Tüm bildirimler IN_APP üzerinden
        gönderilir. Kullanıcı yine de hangi olayları almak istediğini
        seçebilir (IN_APP açık/kapalı). EMAIL/SMS toggle'ları gizlendi
        çünkü arka uç DEFAULT_PREFS de IN_APP-only.
      */}
      {/* Telegram Bağlantı Durumu */}
      <div className="m-3 p-3 rounded-lg bg-[#070c16] border border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-400" />
            <div>
              <div className="text-xs font-bold text-white">Telegram Bildirimleri</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {telegramConnected ? (
                  <span className="text-emerald-400">✅ Telegram hesabınız bağlı</span>
                ) : (
                  'Telegram hesabınızı bağlayarak anlık bildirim alın'
                )}
              </div>
            </div>
          </div>
          {!telegramConnected && telegramLink && (
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold transition-all flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              Telegram Bağla
            </a>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[#070c16] text-slate-400">
            <tr>
              <th className="text-left px-4 py-2 font-bold">Olay</th>
              <th className="px-2 py-2 font-bold w-24 text-center">
                <span className="inline-flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  Uygulama
                </span>
              </th>
              <th className="px-2 py-2 font-bold w-24 text-center">
                <span className="inline-flex items-center gap-1">
                  <Send className="w-3 h-3" />
                  Telegram
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {data.events.map((event) => {
              const meta = EVENT_LABELS[event] || {
                title: event,
                description: '',
              };
              const selected = data.prefs[event] || [];
              const inAppChecked = selected.includes('IN_APP');
              const tgChecked = selected.includes('TELEGRAM');
              return (
                <tr key={event} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="text-slate-200 font-semibold">{meta.title}</div>
                    {meta.description && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {meta.description}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <ChannelToggle checked={inAppChecked} onChange={() => toggle(event, 'IN_APP')} />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <ChannelToggle checked={tgChecked} onChange={() => toggle(event, 'TELEGRAM')} disabled={!telegramConnected} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="px-4 py-3 border-t border-white/[0.04] text-[11px] text-slate-500">
        Telegram bildirimleri için hesabınızı yukarıdaki butonla bağlayın.
        E-posta/SMS bildirimleri ileride aktif edilecektir.
      </footer>
    </div>
  );
}

function ChannelToggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center justify-center select-none ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={disabled ? undefined : onChange}
        disabled={disabled}
      />
      <span
        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
          checked
            ? 'bg-brand-orange border-brand-orange'
            : 'bg-transparent border-white/15 hover:border-white/30'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-white">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </label>
  );
}
