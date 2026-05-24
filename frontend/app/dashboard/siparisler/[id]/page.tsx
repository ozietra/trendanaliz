'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardSidebar from '../../../../components/DashboardSidebar';
import { api } from '../../../../lib/api';
import {
  Loader2,
  ArrowLeft,
  Package,
  Truck,
  User,
  MapPin,
  CreditCard,
  Calendar,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PackageCheck,
  FileText,
  Send,
} from 'lucide-react';

interface AddressBlock {
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  fullAddress?: string;
  city?: string;
  cityCode?: number;
  district?: string;
  neighborhood?: string;
  postalCode?: string;
  countryCode?: string;
  phone?: string;
  email?: string;
}

interface DetailedOrderItem {
  id: string;
  barcode: string;
  productName: string;
  merchantSku?: string | null;
  productSize?: string | null;
  productColor?: string | null;
  quantity: number;
  price: string;
  amount: string;
  discount: string;
  product?: { id: string; title: string } | null;
}

interface DetailedOrder {
  id: string;
  orderNumber: string;
  shipmentPackageId: string;
  status: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  tcIdentityNumber?: string | null;
  taxNumber?: string | null;
  totalPrice: string;
  grossAmount: string;
  totalDiscount: string;
  currencyCode: string;
  orderDate: string;
  estimatedDeliveryStart?: string | null;
  estimatedDeliveryEnd?: string | null;
  cargoTrackingNumber?: string | null;
  cargoProviderName?: string | null;
  cargoTrackingLink?: string | null;
  fastDelivery: boolean;
  deliveryType?: string | null;
  invoiceAddress?: AddressBlock | null;
  shipmentAddress?: AddressBlock | null;
  items: DetailedOrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  Created: 'Oluşturuldu',
  Picking: 'Hazırlanıyor',
  Invoiced: 'Faturalandı',
  Shipped: 'Kargoda',
  Delivered: 'Teslim Edildi',
  Cancelled: 'İptal',
  Returned: 'İade',
};

export default function SiparisDetayPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [order, setOrder] = useState<DetailedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refetch = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data?.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sipariş yüklenemedi.');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        setOrder(res.data?.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Sipariş yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <>
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <Link
          href="/dashboard/siparisler"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Siparişlere Dön
        </Link>

        {loading ? (
          <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-12 text-center">
            <Loader2 className="w-6 h-6 text-brand-orange animate-spin mx-auto" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : order ? (
          <>
            {/* Üst Bilgi */}
            <header className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Sipariş No
                </div>
                <div className="text-lg font-extrabold text-white font-mono mt-0.5">
                  {order.orderNumber}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(order.orderDate).toLocaleString('tr-TR')}
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-1 rounded text-[11px] font-bold border bg-blue-500/10 text-blue-300 border-blue-400/20">
                  {STATUS_LABEL[order.status] || order.status}
                </span>
                <div className="mt-2 text-xl font-extrabold text-white">
                  ₺
                  {Number(order.totalPrice).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                  })}
                </div>
                {Number(order.totalDiscount) > 0 && (
                  <div className="text-[10px] text-emerald-300 mt-0.5">
                    İndirim: ₺
                    {Number(order.totalDiscount).toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                )}
              </div>
            </header>

            {/* Eylem Çubuğu — Trendyol'a yazma operasyonları */}
            <OrderActions
              order={order}
              onSuccess={(msg) => {
                setActionSuccess(msg);
                setActionError(null);
                // Sayfayı yenile
                void refetch();
              }}
              onError={(msg) => {
                setActionError(msg);
                setActionSuccess(null);
              }}
            />

            {actionSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}
            {actionError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Sol: Ürün Satırları */}
              <section className="lg:col-span-2 bg-[#0b1424] border border-white/[0.04] rounded-xl overflow-hidden">
                <header className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-orange" />
                  <h2 className="text-sm font-bold text-white">Ürünler ({order.items.length})</h2>
                </header>
                <ul className="divide-y divide-white/[0.04]">
                  {order.items.map((it) => (
                    <li key={it.id} className="p-4 flex flex-wrap items-start gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <div className="text-sm font-bold text-white">{it.productName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          Barkod: {it.barcode}
                          {it.merchantSku && (
                            <>
                              {' · '}SKU: {it.merchantSku}
                            </>
                          )}
                        </div>
                        {(it.productSize || it.productColor) && (
                          <div className="text-[10px] text-slate-400 mt-1 flex gap-2">
                            {it.productSize && <span>Beden: {it.productSize}</span>}
                            {it.productColor && <span>Renk: {it.productColor}</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-slate-400">
                          {it.quantity} × ₺{Number(it.price).toLocaleString('tr-TR')}
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          ₺{Number(it.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Sağ: Müşteri + Kargo + Adres */}
              <aside className="space-y-3">
                {/* Müşteri */}
                <section className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4">
                  <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-brand-orange" />
                    Müşteri
                  </h3>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div>
                      {order.customerFirstName} {order.customerLastName}
                    </div>
                    {order.customerEmail && (
                      <div className="text-slate-400 text-[11px]">{order.customerEmail}</div>
                    )}
                    {order.customerPhone && (
                      <div className="text-slate-400 text-[11px]">{order.customerPhone}</div>
                    )}
                  </div>
                </section>

                {/* Kargo */}
                <section className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4">
                  <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-brand-orange" />
                    Kargo
                  </h3>
                  {order.cargoProviderName ? (
                    <div className="text-xs text-slate-300 space-y-1">
                      <div className="font-semibold">{order.cargoProviderName}</div>
                      {order.cargoTrackingNumber && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          {order.cargoTrackingNumber}
                        </div>
                      )}
                      {order.cargoTrackingLink && (
                        <a
                          href={order.cargoTrackingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-orange hover:underline text-[11px] mt-1"
                        >
                          Takip Et <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {order.estimatedDeliveryEnd && (
                        <div className="text-[11px] text-slate-400 mt-1">
                          Tahmini teslim:{' '}
                          {new Date(order.estimatedDeliveryEnd).toLocaleDateString('tr-TR')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">Henüz kargoya verilmedi</div>
                  )}
                </section>

                {/* Teslimat Adresi */}
                {order.shipmentAddress && (
                  <section className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4">
                    <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                      Teslimat Adresi
                    </h3>
                    <AddressView a={order.shipmentAddress} />
                  </section>
                )}

                {/* Fatura Adresi */}
                {order.invoiceAddress && (
                  <section className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4">
                    <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-brand-orange" />
                      Fatura Adresi
                    </h3>
                    <AddressView a={order.invoiceAddress} />
                    {(order.tcIdentityNumber || order.taxNumber) && (
                      <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-white/[0.04] space-y-0.5">
                        {order.tcIdentityNumber && <div>TC: {order.tcIdentityNumber}</div>}
                        {order.taxNumber && <div>VKN: {order.taxNumber}</div>}
                      </div>
                    )}
                  </section>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}

// =========================
// OrderActions — Sipariş üzerinde Trendyol'a yazma operasyonları
// =========================
//
// Trendyol akışı: Created -> Picking -> Invoiced -> Shipped -> Delivered
// Satıcı kaynaklı: Picking/Invoiced/Shipped'a manuel geçilebilir.
// "Delivered" otomatik gelir; satıcı set edemez.
// İptal: kalemleri "tedarik edilemedi" (UnSupplied) olarak işaretler.

const PICKING_NEXT: Record<string, 'Picking' | 'Invoiced' | 'Shipped' | null> = {
  Created: 'Picking',
  Picking: 'Invoiced',
  Invoiced: 'Shipped',
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  Picking: 'Hazırlanıyor olarak işaretle',
  Invoiced: 'Faturalandı olarak işaretle',
  Shipped: 'Kargoya verildi olarak işaretle',
};

const STATUS_LOCKED = ['Shipped', 'Delivered', 'Cancelled', 'Returned', 'UnDelivered', 'UnSupplied'];

function OrderActions({
  order,
  onSuccess,
  onError,
}: {
  order: DetailedOrder;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState(order.cargoTrackingNumber || '');
  const [trackingProvider, setTrackingProvider] = useState(order.cargoProviderName || '');
  const [invoiceLink, setInvoiceLink] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const nextStatus = PICKING_NEXT[order.status];
  const writeLocked = STATUS_LOCKED.includes(order.status);

  const submit = async <T,>(
    label: string,
    fn: () => Promise<T>,
    successMsg: string
  ) => {
    setBusy(label);
    try {
      await fn();
      onSuccess(successMsg);
    } catch (err: any) {
      onError(err.response?.data?.message || 'İşlem başarısız.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="bg-[#0b1424] border border-white/[0.04] rounded-xl p-4 space-y-3">
      <header className="flex items-center gap-2">
        <Send className="w-4 h-4 text-brand-orange" />
        <h2 className="text-sm font-bold text-white">Trendyol Eylemleri</h2>
        {writeLocked && (
          <span className="text-[10px] text-slate-500 ml-auto">
            Bu sipariş için yazma işlemleri kilitli (durum: {order.status}).
          </span>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {/* Durum ilerletme */}
        {!writeLocked && nextStatus && (
          <button
            onClick={() =>
              submit(
                'status',
                () => api.put(`/orders/${order.id}/status`, { status: nextStatus }),
                `Sipariş "${nextStatus}" olarak işaretlendi.`
              )
            }
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold disabled:opacity-50"
          >
            {busy === 'status' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PackageCheck className="w-3.5 h-3.5" />
            )}
            {NEXT_STATUS_LABEL[nextStatus]}
          </button>
        )}

        {/* Kargo takip */}
        {!writeLocked && (
          <button
            onClick={() => setTrackingOpen((v) => !v)}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold disabled:opacity-50"
          >
            <Truck className="w-3.5 h-3.5" />
            Kargo Takip {order.cargoTrackingNumber ? '(Değiştir)' : 'Ekle'}
          </button>
        )}

        {/* Fatura linki */}
        {!writeLocked && (
          <button
            onClick={() => setInvoiceOpen((v) => !v)}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            Fatura Linki
          </button>
        )}

        {/* İptal */}
        {!writeLocked && (
          <button
            onClick={() => setCancelOpen((v) => !v)}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold disabled:opacity-50 ml-auto"
          >
            <XCircle className="w-3.5 h-3.5" />
            Siparişi İptal Et
          </button>
        )}
      </div>

      {/* Kargo takip formu */}
      {trackingOpen && !writeLocked && (
        <div className="border-t border-white/[0.04] pt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <FormField label="Takip Numarası">
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Örn: 1234567890"
              className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-brand-orange/40"
            />
          </FormField>
          <FormField label="Kargo Firması (opsiyonel)">
            <input
              type="text"
              value={trackingProvider}
              onChange={(e) => setTrackingProvider(e.target.value)}
              placeholder="Aras, Yurtiçi, MNG..."
              className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-brand-orange/40"
            />
          </FormField>
          <button
            onClick={() =>
              submit(
                'tracking',
                () =>
                  api.put(`/orders/${order.id}/tracking`, {
                    trackingNumber,
                    cargoProviderName: trackingProvider || undefined,
                  }),
                'Kargo takip numarası gönderildi.'
              )
            }
            disabled={busy !== null || trackingNumber.trim().length < 3}
            className="px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold disabled:opacity-50 h-fit"
          >
            {busy === 'tracking' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
            ) : (
              'Gönder'
            )}
          </button>
        </div>
      )}

      {/* Fatura formu */}
      {invoiceOpen && !writeLocked && (
        <div className="border-t border-white/[0.04] pt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <FormField label="Fatura URL'i">
            <input
              type="url"
              value={invoiceLink}
              onChange={(e) => setInvoiceLink(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-brand-orange/40"
            />
          </FormField>
          <FormField label="Fatura No (opsiyonel)">
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="FB2026000001"
              className="w-full px-3 py-2 bg-[#070c16] border border-white/[0.06] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-brand-orange/40"
            />
          </FormField>
          <button
            onClick={() =>
              submit(
                'invoice',
                () =>
                  api.put(`/orders/${order.id}/invoice`, {
                    invoiceLink,
                    invoiceNumber: invoiceNumber || undefined,
                  }),
                'Fatura linki Trendyol\'a iletildi.'
              )
            }
            disabled={busy !== null || !invoiceLink}
            className="px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold disabled:opacity-50 h-fit"
          >
            {busy === 'invoice' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
            ) : (
              'Gönder'
            )}
          </button>
        </div>
      )}

      {/* İptal onayı */}
      {cancelOpen && !writeLocked && (
        <div className="border-t border-white/[0.04] pt-3 space-y-2">
          <div className="text-xs text-slate-300">
            Bu sipariş için tüm kalemler <strong>tedarik edilemedi</strong> olarak
            işaretlenecek. Bu işlem Trendyol'da geri alınamaz.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                submit(
                  'cancel',
                  () => api.post(`/orders/${order.id}/cancel`, { reasonId: 99 }),
                  'Sipariş iptal isteği Trendyol\'a iletildi.'
                ).then(() => setCancelOpen(false))
              }
              disabled={busy !== null}
              className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold disabled:opacity-50"
            >
              {busy === 'cancel' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Evet, İptal Et'
              )}
            </button>
            <button
              onClick={() => setCancelOpen(false)}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function AddressView({ a }: { a: AddressBlock }) {
  return (
    <div className="text-xs text-slate-300 space-y-0.5">
      {(a.firstName || a.lastName) && (
        <div className="font-semibold">
          {a.firstName} {a.lastName}
        </div>
      )}
      {(a.fullAddress || a.address1) && (
        <div className="text-[11px] text-slate-400 leading-relaxed">
          {a.fullAddress || `${a.address1 ?? ''} ${a.address2 ?? ''}`.trim()}
        </div>
      )}
      <div className="text-[11px] text-slate-500">
        {[a.neighborhood, a.district, a.city].filter(Boolean).join(', ')}
      </div>
      {a.phone && <div className="text-[11px] text-slate-500">{a.phone}</div>}
    </div>
  );
}
