'use client';

import React, { useEffect, useState } from 'react';
import AdminSidebar from '../../../components/AdminSidebar';
import { api } from '../../../lib/api';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';

interface Setting {
  id: string;
  key: string;
  value: any;
  updatedAt: string;
}

// Site ayarları için önerilen anahtarlar (boş değer = yeni eklenecek)
const SUGGESTED_KEYS: Array<{ key: string; label: string; placeholder: string; isToggle?: boolean }> = [
  { key: 'site.name', label: 'Site Adı', placeholder: 'TrendAnaliz' },
  { key: 'site.supportEmail', label: 'Destek E-postası', placeholder: 'destek@trendanaliz.com' },
  { key: 'site.iban', label: 'Manuel Ödeme IBAN', placeholder: 'TR00 0000 0000 0000 0000 0000 00' },
  { key: 'site.ibanReceiver', label: 'IBAN Alıcı', placeholder: 'TrendAnaliz Yazılım A.Ş.' },
  { key: 'site.maintenanceMode', label: 'Bakım Modu (true/false)', placeholder: 'false' },
  { key: 'payment.iyzico.enabled', label: 'Iyzico (Kredi Kartı)', placeholder: 'true', isToggle: true },
  { key: 'payment.paytr.enabled', label: 'PayTR (Kredi Kartı)', placeholder: 'true', isToggle: true },
  { key: 'payment.iban.enabled', label: 'Havale / EFT (IBAN)', placeholder: 'false', isToggle: true },
];

export default function AdminSettingsPage() {
  const [items, setItems] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings');
      setItems(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const valueOf = (key: string): string => {
    if (dirty[key] !== undefined) return dirty[key];
    const existing = items.find((s) => s.key === key);
    if (!existing) return '';
    return typeof existing.value === 'string'
      ? existing.value
      : JSON.stringify(existing.value);
  };

  const save = async (key: string) => {
    setBusy(key);
    setError(null);
    try {
      let parsedValue: any = dirty[key];
      // boolean/number parse
      if (parsedValue === 'true') parsedValue = true;
      else if (parsedValue === 'false') parsedValue = false;
      else if (/^-?\d+(\.\d+)?$/.test(parsedValue)) parsedValue = Number(parsedValue);

      await api.put(`/admin/settings/${encodeURIComponent(key)}`, { value: parsedValue });
      const next = { ...dirty };
      delete next[key];
      setDirty(next);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kaydedilemedi.');
    } finally {
      setBusy(null);
    }
  };

  const addNew = async () => {
    if (!newKey.trim()) return;
    setBusy(newKey);
    try {
      let parsedValue: any = newValue;
      if (newValue === 'true') parsedValue = true;
      else if (newValue === 'false') parsedValue = false;
      else if (/^-?\d+(\.\d+)?$/.test(newValue)) parsedValue = Number(newValue);

      await api.put(`/admin/settings/${encodeURIComponent(newKey.trim())}`, { value: parsedValue });
      setNewKey('');
      setNewValue('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Eklenemedi.');
    } finally {
      setBusy(null);
    }
  };

  // Suggested keys among existing or empty
  const allKeys = Array.from(
    new Set([...SUGGESTED_KEYS.map((s) => s.key), ...items.map((i) => i.key)])
  );

  return (
    <>
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="mb-6">
          <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
            Süperadmin
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Site Ayarları
          </h1>
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
            <span className="text-xs text-slate-400">Yükleniyor...</span>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {/* Ödeme Yöntemleri Toggle Grubu */}
            <div className="bg-[#0b1424] border border-brand-orange/20 rounded-xl p-5 mb-2">
              <div className="text-xs font-bold text-brand-orange uppercase tracking-wider mb-4 flex items-center gap-2">
                💳 Ödeme Yöntemleri
              </div>
              <div className="space-y-3">
                {SUGGESTED_KEYS.filter(s => s.isToggle).map((suggested) => {
                  const existing = items.find((s) => s.key === suggested.key);
                  const currentVal = existing ? existing.value : (suggested.placeholder === 'true');
                  const isEnabled = currentVal === true || currentVal === 'true';
                  return (
                    <div key={suggested.key} className="flex items-center justify-between py-2">
                      <div>
                        <div className="text-sm font-bold text-white">{suggested.label}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{suggested.key}</div>
                      </div>
                      <button
                        onClick={async () => {
                          setBusy(suggested.key);
                          try {
                            await api.put(`/admin/settings/${encodeURIComponent(suggested.key)}`, { value: !isEnabled });
                            await load();
                          } catch (err: any) {
                            setError(err.response?.data?.message || 'Kaydedilemedi.');
                          } finally {
                            setBusy(null);
                          }
                        }}
                        disabled={busy === suggested.key}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${isEnabled ? 'bg-brand-orange' : 'bg-white/10'} ${busy === suggested.key ? 'opacity-50' : ''}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Diğer Ayarlar */}
            {allKeys.filter(key => !SUGGESTED_KEYS.find(s => s.key === key && s.isToggle)).map((key) => {
              const suggested = SUGGESTED_KEYS.find((s) => s.key === key);
              const existing = items.find((s) => s.key === key);
              const isDirty = dirty[key] !== undefined;
              return (
                <div
                  key={key}
                  className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="text-xs font-bold text-white">
                        {suggested?.label || key}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{key}</div>
                    </div>
                    {existing && (
                      <span className="text-[9px] text-slate-500">
                        {new Date(existing.updatedAt).toLocaleString('tr-TR')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      value={valueOf(key)}
                      onChange={(e) => setDirty({ ...dirty, [key]: e.target.value })}
                      placeholder={suggested?.placeholder}
                      className="flex-1 bg-white/[0.02] border border-white/[0.06] focus:border-brand-orange/40 outline-none rounded-lg px-3 py-2 text-xs text-white"
                    />
                    <button
                      onClick={() => save(key)}
                      disabled={busy === key || !isDirty}
                      className="px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-30 text-white font-bold text-xs inline-flex items-center gap-1"
                    >
                      {busy === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Kaydet
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Yeni anahtar ekle */}
            <div className="bg-[#0b1424] border border-dashed border-white/[0.08] rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                Yeni Anahtar Ekle
              </div>
              <div className="flex gap-2">
                <input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="örn: site.contactPhone"
                  className="w-1/3 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white"
                />
                <input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Değer"
                  className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white"
                />
                <button
                  onClick={addNew}
                  disabled={!newKey.trim() || busy === newKey}
                  className="px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-30 text-white font-bold text-xs"
                >
                  Ekle
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
