'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  ChevronDown, 
  Check, 
  ArrowRight, 
  Zap, 
  Search, 
  AlertCircle, 
  ShoppingBag, 
  ShieldCheck, 
  PieChart, 
  Sliders,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Lock,
  Info,
  ChevronRight,
  User,
  Store,
  Bell,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { api } from '../lib/api';

// Fallback Plan Listesi (Backend'den veri alınamazsa kullanılacak)
const FALLBACK_PLANS = [
  {
    id: 'starter-plan-id',
    name: 'Starter',
    slug: 'starter',
    description: 'Yeni başlayan küçük ölçekli satıcılar için ideal başlangıç paketi.',
    price: '499.00',
    currency: 'TRY',
    billingCycle: 'MONTHLY',
    maxProducts: 50,
    maxCompetitors: 5,
    refreshInterval: 120,
    features: [
      '50 Ürün Takibi',
      '5 Rakip Takibi',
      '120 Dakika Güncelleme Sıklığı',
      'E-posta Bildirimleri',
      'Temel Listing Analizi'
    ],
    isActive: true,
    isPopular: false,
    sortOrder: 1,
  },
  {
    id: 'pro-plan-id',
    name: 'Pro',
    slug: 'pro',
    description: 'İşini büyütmek ve rekabette öne geçmek isteyen aktif satıcılar.',
    price: '999.00',
    currency: 'TRY',
    billingCycle: 'MONTHLY',
    maxProducts: 250,
    maxCompetitors: 20,
    refreshInterval: 60,
    features: [
      '250 Ürün Takibi',
      '20 Rakip Takibi',
      '60 Dakika Güncelleme Sıklığı',
      'BuyBox ve Stok Bildirimleri (Anlık)',
      'Gelişmiş Fiyatlandırma Kuralları',
      'Listing Kalite Skoru ve Önerileri',
      '7 Günlük Satış Tahmin Modeli'
    ],
    isActive: true,
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: 'business-plan-id',
    name: 'Business',
    slug: 'business',
    description: 'Çoklu mağaza yönetimi ve maksimum hızda rekabet gücü arayan profesyoneller.',
    price: '1999.00',
    currency: 'TRY',
    billingCycle: 'MONTHLY',
    maxProducts: 99999,
    maxCompetitors: 99999,
    refreshInterval: 15,
    features: [
      'Sınırsız Ürün Takibi',
      'Sınırsız Rakip Takibi',
      '15 Dakika Güncelleme Sıklığı',
      'Anlık Bildirimler (Uygulama içi / SSE)',
      'Rakip Satıcı Web Scraping Detayları',
      'Yapay Zeka Destekli 30 Günlük Tahmin',
      'Detaylı Kampanya ROI Analizi',
      '7/24 Öncelikli Canlı Destek'
    ],
    isActive: true,
    isPopular: false,
    sortOrder: 3,
  },
];

export default function LandingPage() {
  const [plans, setPlans] = useState<any[]>(FALLBACK_PLANS);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await api.get('/public/plans');
        if (response.data && response.data.success && Array.isArray(response.data.data)) {
          setPlans(response.data.data);
        }
      } catch (error) {
        console.error('Planlar backendden yuklenemedi, fallback kullaniliyor:', error);
      } finally {
        setLoadingPlans(false);
      }
    }
    fetchPlans();
  }, []);

  const toggleFaq = (index: number) => {
    if (activeFaq === index) {
      setActiveFaq(null);
    } else {
      setActiveFaq(index);
    }
  };

  const faqData = [
    {
      question: 'TrendAnaliz nedir ve Trendyol satıcılarına nasıl yardımcı olur?',
      answer: 'TrendAnaliz, Trendyol satıcıları için özel olarak geliştirilmiş bulut tabanlı bir analiz ve otomasyon platformudur. Rakiplerinizin fiyatlarını 7/24 izler, belirlediğiniz kurallara göre kendi fiyatlarınızı otomatik olarak günceller, stoklarınızı takip eder, kelime sıralamanızı analiz eder ve satışlarınızı artırmak için yapay zeka destekli öneriler sunar.'
    },
    {
      question: 'Trendyol API bilgilerimi girmek güvenli midir?',
      answer: 'Evet, kesinlikle güvenlidir. API anahtarlarınız banka seviyesinde AES-256 şifreleme protokolleriyle veritabanımızda saklanır. TrendAnaliz, Trendyol API standartlarına %100 uyumludur ve hesabınızı tehlikeye atacak hiçbir izinsiz işlem gerçekleştirmez.'
    },
    {
      question: 'Otomatik fiyatlandırma (Repricer) ne kadar hızlı çalışır?',
      answer: 'Seçtiğiniz pakete bağlı olarak fiyat güncelleme sıklığı değişir. Starter paketinde 120 dakikada bir, Pro paketinde 60 dakikada bir, Business paketinde ise sadece 15 dakikada bir fiyat eşitlemesi ve rakip analizi yapılır. Bu sayede BuyBox kutusunu asla rakiplerinize kaptırmazsınız.'
    },
    {
      question: 'Hemen kullanmaya nasıl başlayabilirim ve iptal şartları nelerdir?',
      answer: 'Kayıt olduktan hemen sonra dilediğiniz aylık veya yıllık paketi seçip Iyzico, PayTR ya da banka havalesi/EFT ile ödemenizi tamamlayabilirsiniz. Ödemeniz alındığı anda hesabınız aktive edilir. Aboneliğinizi otomatik yenileme dönemi öncesinde tek tıkla iptal edebilir, kalan süre boyunca tüm özellikleri kullanmaya devam edebilirsiniz. Yasal cayma hakkınız 14 gün içinde geçerlidir.'
    },
    {
      question: 'BuyBox takibi nasıl yapılır ve bana nasıl haber verilir?',
      answer: 'Sistemimiz ürünlerinizin Trendyol üzerindeki BuyBox durumunu sürekli analiz eder. BuyBox kutusunu kaybettiğinizde veya rakipleriniz fiyat kırdığında uygulama içinde anında bildirim alırsınız (Server-Sent Events ile gerçek zamanlı). E-posta ve SMS bildirimleri ilerleyen sürümlerde aktif edilecektir.'
    },
    {
      question: 'Listing Kalite Skoru nedir?',
      answer: 'Trendyol algoritmasının ürünlerinizi aramalarda üst sıralara çıkarması için ürün başlığı, açıklaması, görselleri, özellikleri ve müşteri yorumları kritik öneme sahiptir. Algoritmamız ürünlerinizi analiz ederek eksiklikleri tespit eder ve Trendyol SEO kriterlerine uygun optimizasyon önerileri oluşturur.'
    },
    {
      question: 'Birden fazla mağaza bağlayabilir miyim?',
      answer: 'Şu an her hesaba bir Trendyol mağazası bağlanmaktadır. Çoklu mağaza desteği yol haritamızda yer almakta olup talebe göre öncelik kazanacaktır. Birden fazla mağazanız varsa lütfen destek hattımız üzerinden ulaşın, sizin için özel çözüm sunalım.'
    },
    {
      question: 'Taahhüt vermem gerekiyor mu? Üyeliğimi dilediğim zaman iptal edebilir miyim?',
      answer: 'Hayır, hiçbir taahhüt bulunmamaktadır. Aboneliğimiz aylık periyotlar halinde yenilenir. İstediğiniz ay üyeliğinizi tek bir tıklamayla durdurabilir, hiçbir ek ücret ödemeden dönem sonunda sistem kullanımını sonlandırabilirsiniz.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c1424] via-[#121c2e] to-[#080d16] text-slate-100 flex flex-col antialiased selection:bg-brand-orange selection:text-white">
      
      {/* 1. Navbar Section */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.04] bg-[#0c1424]/80 backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo (Typography wordmark only, no SVG icon as per feedback) */}
          <Link href="/" className="flex items-center gap-1 group">
            <span className="text-2xl font-black tracking-tight text-white group-hover:text-brand-orange transition-colors">
              Trend<span className="text-brand-orange">Analiz</span><span className="text-brand-orange">.</span>
            </span>
          </Link>

          {/* Navigation Anchors */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#sorunlar" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">Sorunlar</a>
            <a href="#ozellikler" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">Özellikler</a>
            <a href="#nasil-calisir" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">Nasıl Çalışır</a>
            <a href="#fiyatlandirma" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">Fiyatlandırma</a>
            <a href="#sss" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">SSS</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <Link 
              href="/giris" 
              className="text-sm font-medium text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
            >
              Giriş Yap
            </Link>
            <Link 
              href="/kayit" 
              className="hidden sm:inline-flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-brand-orange/15 hover:shadow-brand-orange/25 transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Plan Seç ve Başla</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-36">
        {/* Soft elegant glowing ambient backgrounds for breathing room */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-orange/[0.05] blur-[150px]" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-500/[0.03] blur-[180px]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center space-y-6 sm:space-y-8 animate-fadeIn">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-md shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-ping"></span>
            <span className="text-xs font-semibold text-slate-300">TrendAnaliz ile Gücünüze Güç Katın</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[64px] font-black tracking-tight leading-[1.08] text-white max-w-4xl">
            Trendyol'da Rekabeti <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-brand-orange-light">
              Siz Belirleyin
            </span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-slate-300 leading-relaxed max-w-3xl">
            Rakiplerinizi 7/24 izleyen akıllı algoritmalarımızla BuyBox kutusunu elinizde tutun. Fiyatlarınızı otomatik güncelleyin, kelime analizi yapın ve karlılığınızı anlık izleyin.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 pt-4 w-full sm:w-auto">
            <Link 
              href="/kayit" 
              className="bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-center text-sm px-8 py-4 rounded-xl shadow-lg shadow-brand-orange/20 hover:shadow-brand-orange/30 flex items-center justify-center gap-2 transform hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <span>Plan Seç ve Başla</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="#ozellikler" 
              className="border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold text-center px-8 py-4 rounded-xl transition-all"
            >
              Özellikleri Keşfet
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm text-slate-400 pt-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-brand-orange shrink-0 animate-pulse" />
              <span>Kredi Kartı Gerekmez</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-brand-orange shrink-0 animate-pulse" />
              <span>1 Dakikada Kurulum</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-brand-orange shrink-0 animate-pulse" />
              <span>14 Gün Cayma Hakkı</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Sorun-Çözüm (Problem-Solution) Section */}
      <section id="sorunlar" className="py-24 bg-[#091324]/60 border-t border-b border-white/[0.03] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange">Sorunlar ve Kesin Çözümler</h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Trendyol Satıcılarının Yaşadığı Zorlukları Biliyoruz
            </p>
            <p className="mt-4 text-slate-400 text-sm">
              Klasik yöntemler ve manuel e-tablo takipleriyle rekabete ayak uydurmak imkansızdır. TrendAnaliz ile tüm engelleri otomatik aşın.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Problems Panel */}
            <div className="bg-slate-900/40 rounded-2xl border border-red-500/10 p-8 space-y-6">
              <h3 className="text-lg font-bold text-red-400 flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span>Neden Kaybediyorsunuz?</span>
              </h3>
              <div className="space-y-4 divide-y divide-white/[0.05]">
                <div className="pt-4 first:pt-0">
                  <h4 className="font-bold text-white text-sm">1. Sürekli Fiyat Savaşı ve BuyBox Kaybı</h4>
                  <p className="text-slate-400 text-xs mt-1">Günün her saati rakipleri izleyip manuel fiyat değiştirmek imkansızdır. BuyBox kaybedildiğinde satışlarınız sıfırlanır.</p>
                </div>
                <div className="pt-4">
                  <h4 className="font-bold text-white text-sm">2. Stokların Fark Edilmeden Tükenmesi</h4>
                  <p className="text-slate-400 text-xs mt-1">Trendyol'da stoğu biten veya kritik seviyeye inen ürünler cezalandırılır. Satış ivmesini bir anda kaybedersiniz.</p>
                </div>
                <div className="pt-4">
                  <h4 className="font-bold text-white text-sm">3. Düşük Arama Görünürlüğü (SEO Eksiği)</h4>
                  <p className="text-slate-400 text-xs mt-1">Doğru kelimeleri ve Trendyol algoritma kurallarını bilmediğiniz için en çok aranan kelimelerde son sayfalarda kalırsınız.</p>
                </div>
                <div className="pt-4">
                  <h4 className="font-bold text-white text-sm">4. Zarar Ettiren Kampanyalar (Kör ROI)</h4>
                  <p className="text-slate-400 text-xs mt-1">Hangi kampanyanın ciro kazandırırken ne kadar komisyon ve kargo maliyeti yuttuğunu bilmeden reklam bütçesi harcarsınız.</p>
                </div>
              </div>
            </div>

            {/* Solutions Panel */}
            <div className="bg-slate-900/40 rounded-2xl border border-brand-orange/10 p-8 space-y-6">
              <h3 className="text-lg font-bold text-brand-orange-light flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-brand-orange" />
                <span>TrendAnaliz Nasıl Çözer?</span>
              </h3>
              <div className="space-y-4 divide-y divide-white/[0.05]">
                <div className="pt-4 first:pt-0">
                  <h4 className="font-bold text-white text-sm">1. 15 Dakikalık Otomatik Fiyatlandırıcı</h4>
                  <p className="text-slate-400 text-xs mt-1">Repricer robotları rakipleri saniyeler içinde tarar ve kuralınıza göre BuyBox'ı geri alacak en karlı fiyatı Trendyol'a yükler.</p>
                </div>
                <div className="pt-4">
                  <h4 className="font-bold text-white text-sm">2. Akıllı Tahminleme ve Stok Uyarısı</h4>
                  <p className="text-slate-400 text-xs mt-1">Yapay zeka modellerimiz son satış hızınızı ölçerek kaç günlük stoğunuz kaldığını hesaplar ve size kritik zaman bildirimleri yollar.</p>
                </div>
                <div className="pt-4">
                  <h4 className="font-bold text-white text-sm">3. Yapay Zeka Destekli Listing Optimizasyonu</h4>
                  <p className="text-slate-400 text-xs mt-1">Hatalı veya eksik ürün detaylarını, başlıkları saniyeler içinde analiz eder. SEO skorunuzu yükseltip organik trafiği uçurur.</p>
                </div>
                <div className="pt-4">
                  <h4 className="font-bold text-white text-sm">4. Net Karlılık ve Gelişmiş ROI Analizi</h4>
                  <p className="text-slate-400 text-xs mt-1">Komisyon, kargo, iade ve alış maliyetlerini tek tek hesaplayarak cebinize kalan net TL karı ve kampanya verimini gösterir.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. Features Section (6 Cards) */}
      <section id="ozellikler" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange">Öne Çıkan Özellikler</h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Mağazanızı Uçuracak 6 Güçlü Süper Güç
            </p>
            <p className="mt-4 text-slate-400 text-sm">
              Yazılım dünyasının en son teknolojilerini Trendyol'un dinamik yapısıyla entegre ettik.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-[#091324]/40 border border-white/[0.04] p-8 rounded-2xl hover:border-brand-orange/20 hover:bg-[#091324]/60 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-6 group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-brand-orange transition-colors">7/24 Rakip Fiyat Takibi</h3>
              <p className="mt-3 text-slate-400 text-xs leading-relaxed">
                Rakiplerinizin Trendyol üzerindeki tüm fiyat hareketlerini, indirimlerini ve stok durumlarını anbean takip edin, raporlayın.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#091324]/40 border border-white/[0.04] p-8 rounded-2xl hover:border-brand-orange/20 hover:bg-[#091324]/60 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-6 group-hover:scale-110 transition-transform">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-brand-orange transition-colors">Otomatik Fiyatlandırıcı</h3>
              <p className="mt-3 text-slate-400 text-xs leading-relaxed">
                BuyBox'ı almak veya karlı kalmak için kurallar belirleyin. Robotlarımız Trendyol API üzerinden fiyatlarınızı saniyeler içinde güncellesin.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#091324]/40 border border-white/[0.04] p-8 rounded-2xl hover:border-brand-orange/20 hover:bg-[#091324]/60 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-6 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-brand-orange transition-colors">SEO & Listing Denetimi</h3>
              <p className="mt-3 text-slate-400 text-xs leading-relaxed">
                Trendyol algoritmasına uygun kelime optimizasyonu, görsel ve açıklama analizi ile ürünlerinizin arama listelerinde en üste çıkmasını sağlayın.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-[#091324]/40 border border-white/[0.04] p-8 rounded-2xl hover:border-brand-orange/20 hover:bg-[#091324]/60 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-brand-orange transition-colors">Satış ve Stok Öngörüsü</h3>
              <p className="mt-3 text-slate-400 text-xs leading-relaxed">
                Yapay zeka modelleri geçmiş satış verilerini inceleyerek stoklarınızın ne zaman tükeneceğini tahmin eder ve depo kayıplarının önüne geçer.
              </p>
            </div>

            {/* Card 5 */}
            <div className="bg-[#091324]/40 border border-white/[0.04] p-8 rounded-2xl hover:border-brand-orange/20 hover:bg-[#091324]/60 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-6 group-hover:scale-110 transition-transform">
                <PieChart className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-brand-orange transition-colors">Komisyon ve ROI Takibi</h3>
              <p className="mt-3 text-slate-400 text-xs leading-relaxed">
                Trendyol'un karmaşık komisyon, reklam ve kargo maliyetlerini filtreleyin. Her bir satışın size kazandırdığı gerçek net karı görün.
              </p>
            </div>

            {/* Card 6 */}
            <div className="bg-[#091324]/40 border border-white/[0.04] p-8 rounded-2xl hover:border-brand-orange/20 hover:bg-[#091324]/60 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-brand-orange transition-colors">BuyBox ve Rakip Alarmları</h3>
              <p className="mt-3 text-slate-400 text-xs leading-relaxed">
                BuyBox'ı kaybettiğinizde, rakip stoğu bittiğinde ya da beklenmedik fiyat kırılımlarında SMS ve E-posta ile anlık uyarı alın.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 5. Nasıl Çalışır (How It Works) Section */}
      <section id="nasil-calisir" className="py-24 bg-[#091324]/60 border-t border-b border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange">Süreç Nasıl İşler?</h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Sadece 3 Adımda Otomasyona Geçin
            </p>
            <p className="mt-4 text-slate-400 text-sm">
              Karmaşık entegrasyonlar veya yazılım bilgisi gerekmez. Her adımı sizin yerinize biz hallederiz.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-[#0A162B] border-2 border-brand-orange flex items-center justify-center font-bold text-xl text-white shadow-xl shadow-brand-orange/10">
                1
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">Mağazanızı Bağlayın</h3>
              <p className="mt-3 text-slate-400 text-xs max-w-xs leading-relaxed">
                Trendyol satıcı panelinizden alacağınız API entegrasyon bilgilerini sisteme girin. Bağlantı 1 dakikada tamamlanır.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#0A162B] border-2 border-white/10 flex items-center justify-center font-bold text-xl text-white">
                2
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">Kuralları Belirleyin</h3>
              <p className="mt-3 text-slate-400 text-xs max-w-xs leading-relaxed">
                İstediğiniz ürünler için akıllı fiyatlandırma limitlerinizi, minimum kar marjlarınızı ve alarm tercihlerini ayarlayın.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#0A162B] border-2 border-brand-orange flex items-center justify-center font-bold text-xl text-white shadow-xl shadow-brand-orange/10">
                3
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">Satışlarınızı İzleyin</h3>
              <p className="mt-3 text-slate-400 text-xs max-w-xs leading-relaxed">
                TrendAnaliz botları 7/24 çalışırken siz sadece artan satış grafiğinizi ve net cebinize kalan karı panelden takip edin.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 6. Social Proof / Testimonials Section (Clean profile placeholders, no text initials, realistic copy) */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange">Mutlu Satıcılar</h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Kullanıcılarımızın Görüşleri
            </p>
            <p className="mt-4 text-slate-400 text-sm">
              Türkiye genelinde profesyonel Trendyol mağazaları rekabet gücünü bizimle artırdı.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-[#091324]/40 border border-white/[0.04] p-8 rounded-2xl flex flex-col justify-between space-y-6 hover:border-brand-orange/20 transition-all duration-300">
              <p className="text-slate-300 text-sm italic leading-relaxed">
                "Trendyol'da sürekli birileri fiyat kırıyor, Buybox'ı kaptırmamak için bilgisayar başında nöbet tutuyordum. TrendAnaliz'e geçtikten sonra işi robota devrettim. Rakipler fiyat kırdığında bizim fiyat otomatik güncelleniyor, hem Buybox bizde kalıyor hem de kâr marjımız erimiyor."
              </p>
              <div className="flex items-center gap-3 border-t border-white/[0.05] pt-4">
                {/* Elegant abstract gradient circle instead of text initials */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-orange to-brand-orange-light flex items-center justify-center border border-white/10 shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Hakan Kara</h4>
                  <span className="text-[10px] text-slate-400">Kozmetik Satıcısı</span>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-[#091324]/40 border border-white/[0.04] p-8 rounded-2xl flex flex-col justify-between space-y-6 hover:border-brand-orange/20 transition-all duration-300">
              <p className="text-slate-300 text-sm italic leading-relaxed">
                "Kampanyalara katılıyoruz ama gün sonunda ne kazandığımızı hiç bilmiyorduk. Komisyon oranları, kargo ücretleri derken net kârı hesaplamak tam bir işkenceydi. Bu panel sayesinde her siparişin komisyonunu ve kargosunu düşüp net TL kârımızı kuruşu kuruşuna görüyoruz."
              </p>
              <div className="flex items-center gap-3 border-t border-white/[0.05] pt-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center border border-white/10 shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Melis Aydın</h4>
                  <span className="text-[10px] text-slate-400">Ev Tekstili Mağazası Sahibi</span>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-[#091324]/40 border border-white/[0.04] p-8 rounded-2xl flex flex-col justify-between space-y-6 hover:border-brand-orange/20 transition-all duration-300">
              <p className="text-slate-300 text-sm italic leading-relaxed">
                "Birden fazla Trendyol mağazamız var ve stok takibi en büyük sorunumuzdu. Stoğu biten ürün yüzünden kaç kez mağaza puanımız düştü. Şimdi sistem stok azalınca anında cepten uyarıyor, hemen yeni siparişi geçiyoruz. İki aydır bir kez bile stoksuzluğa düşmedik."
              </p>
              <div className="flex items-center gap-3 border-t border-white/[0.05] pt-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center border border-white/10 shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Burak Koç</h4>
                  <span className="text-[10px] text-slate-400">Elektronik Aksesuar Satıcısı</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 7. Pricing Section */}
      <section id="fiyatlandirma" className="py-24 bg-[#091324]/60 border-t border-b border-white/[0.03] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange">Bütçenize Uygun Paketler</h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Esnek ve Şeffaf Fiyatlandırma
            </p>
            <p className="mt-4 text-slate-400 text-sm">
              Kredi kartı girmeden hemen başlayın. İhtiyacınıza en uygun paketi seçin, dilediğiniz zaman kolayca iptal edin.
            </p>
          </div>

          {loadingPlans ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-xs font-semibold">Plan seçenekleri yükleniyor...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              {plans.map((plan) => {
                const isPro = plan.isPopular || plan.slug === 'pro';
                const isClosed = plan.isActive === false;
                return (
                  <div 
                    key={plan.id}
                    className={`relative rounded-2xl border transition-all duration-300 flex flex-col justify-between bg-slate-900/60 ${isClosed ? 'opacity-60 border-white/[0.03]' : isPro ? 'border-brand-orange shadow-2xl shadow-brand-orange/10 -translate-y-2' : 'border-white/[0.05] hover:border-white/10'}`}
                  >
                    {isPro && !isClosed && (
                      <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-brand-orange text-white text-[10px] font-extrabold tracking-widest px-4 py-1.5 rounded-full uppercase">
                        En Popüler Paket
                      </div>
                    )}
                    {isClosed && (
                      <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-red-500/80 text-white text-[10px] font-extrabold tracking-widest px-4 py-1.5 rounded-full uppercase">
                        Satışa Kapalı
                      </div>
                    )}

                    <div className="p-8">
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      <p className="mt-3 text-slate-400 text-xs min-h-[32px] leading-relaxed">{plan.description}</p>
                      
                      <div className="mt-6 flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-extrabold text-white">₺{parseFloat(plan.price).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}</span>
                        <span className="text-xs text-slate-400 font-semibold">/ ay</span>
                      </div>

                      <div className="mt-8 space-y-4 border-t border-white/[0.05] pt-6">
                        <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">Paket İçeriği</span>
                        <ul className="space-y-3">
                          {(() => {
                            const rawFeatures = plan.features;
                            let featuresList: string[] = [];
                            if (Array.isArray(rawFeatures)) {
                              featuresList = rawFeatures;
                            } else if (typeof rawFeatures === 'string') {
                              try {
                                const parsed = JSON.parse(rawFeatures);
                                if (Array.isArray(parsed)) {
                                  featuresList = parsed;
                                }
                              } catch {
                                // ignore
                              }
                            }
                            return featuresList.map((feature: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                                <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                                <span>{feature}</span>
                              </li>
                            ));
                          })()}
                        </ul>
                      </div>
                    </div>

                    <div className="p-8 border-t border-white/[0.05]">
                      {isClosed ? (
                        <span className="w-full text-center block font-bold text-sm py-3.5 rounded-xl bg-white/5 text-slate-500 border border-white/[0.06] cursor-not-allowed">
                          Satışa Kapalı
                        </span>
                      ) : (
                        <Link 
                          href={`/kayit?plan=${plan.slug}`}
                          className={`w-full text-center block font-bold text-sm py-3.5 rounded-xl transition-all ${isPro ? 'bg-brand-orange hover:bg-brand-orange-hover text-white shadow-lg shadow-brand-orange/10 hover:shadow-brand-orange/20 transform hover:-translate-y-0.5' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
                        >
                          Planı Seç
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-12 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-center gap-4">
            <span>Aylık veya yıllık paketler arasından seçim yapın, dilediğiniz an iptal edin.</span>
            <span className="hidden sm:inline text-white/10">|</span>
            <Link href="/kayit" className="text-brand-orange hover:underline font-bold">
              Hemen Kaydol ve Başla
            </Link>
          </div>

        </div>
      </section>

      {/* 8. SSS Section */}
      <section id="sss" className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange">Merak Edilenler</h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Sıkça Sorulan Sorular
            </p>
            <p className="mt-4 text-slate-400 text-sm">
              Platformumuz ve entegrasyon süreciyle ilgili en çok merak edilen konular.
            </p>
          </div>

          <div className="space-y-4">
            {faqData.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div 
                  key={index}
                  className="bg-[#091324]/40 border border-white/[0.04] rounded-xl overflow-hidden transition-all duration-300 animate-fadeIn"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                  >
                    <span className="font-bold text-white text-sm sm:text-base">{faq.question}</span>
                    <ChevronDown 
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-orange' : ''}`} 
                    />
                  </button>
                  
                  <div 
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[250px] border-t border-white/[0.05] opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className="px-6 py-5 text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#070E1A]/40">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 9. Pre-Footer CTA Banner */}
      <section className="py-20 bg-gradient-to-r from-[#0A1220] via-[#091324] to-[#0A1220] relative overflow-hidden border-t border-white/[0.03]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Trendyol Satışlarınızı Bugün Katlayın
          </h2>
          <p className="text-slate-300 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Karmaşık maliyet analizleriyle vakit kaybetmeyin, fiyat değişimlerini kaçırmayın. Size uygun planı seçin ve dakikalar içinde rakiplerinizin önüne geçin.
          </p>
          <div className="pt-4 flex justify-center">
            <Link 
              href="/kayit" 
              className="bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-sm px-8 py-4 rounded-xl shadow-xl shadow-brand-orange/20 hover:shadow-brand-orange/30 flex items-center gap-2 transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Plan Seç ve Başla</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 10. Footer Section with Disclaimers */}
      <footer className="bg-[#060D1A] border-t border-white/[0.05] text-slate-400 text-xs py-16 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="space-y-4">
              <span className="text-xl font-black text-white tracking-tight">
                Trend<span className="text-brand-orange">Analiz</span>.
              </span>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Trendyol satıcıları için özel olarak geliştirilmiş yapay zeka destekli izleme, otomatik fiyatlandırma ve listing optimizasyonu aracı.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs tracking-wider uppercase mb-4">Hızlı Bağlantılar</h4>
              <ul className="space-y-2.5 text-[11px]">
                <li><a href="#sorunlar" className="hover:text-white transition-colors">Sorun ve Çözümler</a></li>
                <li><a href="#ozellikler" className="hover:text-white transition-colors">Özellikler</a></li>
                <li><a href="#nasil-calisir" className="hover:text-white transition-colors">Nasıl Çalışır</a></li>
                <li><a href="#fiyatlandirma" className="hover:text-white transition-colors">Fiyatlandırma</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs tracking-wider uppercase mb-4">Yasal</h4>
              <ul className="space-y-2.5 text-[11px]">
                <li><Link href="/giris" className="hover:text-white transition-colors">Giriş Yap</Link></li>
                <li><Link href="/kayit" className="hover:text-white transition-colors">Kayıt Ol</Link></li>
                <li><Link href="/yasal/sozlesme" className="hover:text-white transition-colors">Kullanım Koşulları</Link></li>
                <li><Link href="/yasal/gizlilik" className="hover:text-white transition-colors">Gizlilik Sözleşmesi</Link></li>
                <li><Link href="/yasal/kvkk" className="hover:text-white transition-colors">KVKK Aydınlatma Metni</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs tracking-wider uppercase mb-4">Güvenli Altyapı</h4>
              <div className="space-y-3 text-[11px] leading-relaxed">
                <p>Verileriniz AES-256 ile şifrelenir ve Trendyol entegrasyonu tamamen resmi API standartlarına uygun olarak çalışır.</p>
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold pt-1">
                  <Lock className="w-3.5 h-3.5 text-brand-orange" />
                  <span>SSL Güvenli Bağlantı</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.05] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-slate-500">
              &copy; {new Date().getFullYear()} TrendAnaliz. Tüm hakları saklıdır.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-slate-600 font-semibold tracking-wider">TÜRKİYE</span>
            </div>
          </div>

          {/* Mandatory Official Partner Disclaimer */}
          <div className="border-t border-white/[0.05] pt-6 text-[10px] text-slate-500 text-justify leading-relaxed">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
              <p>
                <strong>Önemli Yasal Feragatname:</strong> TrendAnaliz bağımsız bir yazılım çözümüdür. Bu platformun Trendyol (DSM Grup Danışmanlık İletişim ve Satış Ticaret A.Ş.) ile doğrudan resmi bir ortaklığı, iş birliği, sponsorluğu veya sahipliği bulunmamaktadır. "Trendyol" markası ve ilgili logolar, DSM Grup Danışmanlık İletişim ve Satış Ticaret A.Ş.'nin tescilli ticari markalarıdır. Platformumuzda sunulan tüm analiz ve otomasyon araçları, satıcılara kendi API anahtarlarıyla bilgi sağlama amacı gütmektedir.
              </p>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
