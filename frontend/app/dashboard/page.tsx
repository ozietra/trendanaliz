'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import DashboardSidebar from '../../components/DashboardSidebar';
import { 
  BarChart3, 
  Sliders, 
  Search, 
  Settings, 
  ShoppingBag, 
  User, 
  Check, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Save, 
  RefreshCw, 
  SlidersHorizontal, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  Store,
  HelpCircle,
  X,
  Database,
  Terminal,
  Activity
} from 'lucide-react';

// Types
interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  competitorPrice: number;
  buybox: boolean;
  minPrice: number;
  maxPrice: number;
  rule: string;
  repricerActive: boolean;
}

interface Competitor {
  id: string;
  name: string;
  overlapCount: number;
  buyboxRate: number;
  updatedAt: string;
}

interface RepricerRule {
  id: string;
  name: string;
  type: 'min-match' | 'buybox-defense' | 'stock-boost';
  limit: number;
  step: number;
  minMargin?: number;
  activeCount: number;
  isActive: boolean;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'genel' | 'repricer' | 'rakip' | 'settings'>('genel');
  const [buyboxFilter, setBuyboxFilter] = useState<'all' | 'lost'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  
  // API Integration state
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [apiConnected, setApiConnected] = useState(false);
  const [apiTesting, setApiTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiLogs, setApiLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Stateful Data
  const [products, setProducts] = useState<Product[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [rules, setRules] = useState<RepricerRule[]>([]);

  // Dashboard Stats (API'den gelen dinamik veriler)
  const [dashboardStats, setDashboardStats] = useState<{
    todaySales: number;
    todaySalesChange: number;
    buyboxWinRate: number;
    buyboxStatus: string;
    activeRepricerCount: number;
    priceChangeCount: number;
    connectedStore: boolean;
  } | null>(null);

  // Modal States
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [newCompetitorId, setNewCompetitorId] = useState('');
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'min-match' | 'buybox-defense' | 'stock-boost'>('min-match');
  const [newRuleLimit, setNewRuleLimit] = useState('');
  const [newRuleStep, setNewRuleStep] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [storeRes, statsRes] = await Promise.all([
        api.get('/store/status'),
        api.get('/store/dashboard-stats').catch(() => ({ data: { success: false } })),
      ]);

      if (statsRes.data.success) {
        setDashboardStats(statsRes.data.data);
      }

      if (storeRes.data.success && storeRes.data.connected) {
        setApiConnected(true);
        setSellerId(storeRes.data.data.supplierId);
        setApiKey(storeRes.data.data.apiKey);
        setApiSecret('••••••••••••••••••••••••••••••••');
        
        // Parallel fetches
        const [prodRes, compRes, rulesRes, logsRes] = await Promise.all([
          api.get('/products'),
          api.get('/competitors'),
          api.get('/rules'),
          api.get('/store/logs')
        ]);

        if (prodRes.data.success) setProducts(prodRes.data.data);
        if (compRes.data.success) setCompetitors(compRes.data.data);
        if (rulesRes.data.success) setRules(rulesRes.data.data);
        if (logsRes.data.success) setApiLogs(logsRes.data.logs);
      } else {
        setApiConnected(false);
      }
    } catch (err) {
      console.error('Veri yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogsOnly = async () => {
    try {
      const logsRes = await api.get('/store/logs');
      if (logsRes.data.success) {
        setApiLogs(logsRes.data.logs);
      }
    } catch (err) {
      console.error('Log çekme hatası:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Polling loop for logs (every 3 seconds if connected)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (apiConnected) {
      interval = setInterval(() => {
        fetchLogsOnly();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [apiConnected]);

  // Auto-scroll logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [apiLogs]);



  // API Integration Connection
  const triggerApiTest = async () => {
    if (!sellerId || !apiKey || !apiSecret) {
      alert('Lütfen tüm entegrasyon parametrelerini doldurun.');
      return;
    }
    setApiTesting(true);
    setApiLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}] API bağlantısı kuruluyor (Satıcı ID: ${sellerId})...`]);
    
    try {
      const res = await api.post('/store/integrate', {
        supplierId: sellerId,
        apiKey,
        apiSecret,
        storeName: 'Trendyol Akıllı Mağaza'
      });

      if (res.data.success) {
        setApiConnected(true);
        // Refresh everything
        await fetchDashboardData();
      } else {
        alert(res.data.message || 'API entegrasyonu başarısız.');
      }
    } catch (err: any) {
      console.error('Entegrasyon hatası:', err);
      alert(err.response?.data?.message || 'Entegrasyon sırasında bir hata oluştu.');
    } finally {
      setApiTesting(false);
    }
  };

  // Toggle Repricer for product
  const handleProductRepricerToggle = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const nextState = !product.repricerActive;
    
    try {
      const res = await api.put(`/products/${productId}/repricer`, { active: nextState });
      if (res.data.success) {
        setProducts(products.map(p => p.id === productId ? { ...p, repricerActive: nextState } : p));
        await fetchLogsOnly();
      }
    } catch (err) {
      console.error('Repricer toggle hatası:', err);
    }
  };

  // Save product limits
  const handleSaveProductEdit = async () => {
    if (!editProduct) return;

    try {
      const res = await api.put(`/products/${editProduct.id}/rule`, {
        minPrice: editProduct.minPrice,
        maxPrice: editProduct.maxPrice,
        ruleType: editProduct.rule,
        targetValue: editProduct.rule === 'buybox-defense' ? 0.50 : 0.00
      });

      if (res.data.success) {
        const prodRes = await api.get('/products');
        if (prodRes.data.success) setProducts(prodRes.data.data);
        await fetchLogsOnly();
        setEditProduct(null);
      }
    } catch (err) {
      console.error('Kural güncelleme hatası:', err);
    }
  };

  // Rule activation toggle
  const handleRuleToggle = async (ruleId: string) => {
    try {
      const res = await api.put(`/rules/${ruleId}/toggle`);
      if (res.data.success) {
        const [rulesRes, prodRes] = await Promise.all([
          api.get('/rules'),
          api.get('/products')
        ]);
        if (rulesRes.data.success) setRules(rulesRes.data.data);
        if (prodRes.data.success) setProducts(prodRes.data.data);
        await fetchLogsOnly();
      }
    } catch (err) {
      console.error('Kural toggle hatası:', err);
    }
  };

  // Add competitor
  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompetitorName.trim()) return;

    try {
      const res = await api.post('/competitors', {
        name: newCompetitorName,
        sellerId: newCompetitorId
      });

      if (res.data.success) {
        const compRes = await api.get('/competitors');
        if (compRes.data.success) setCompetitors(compRes.data.data);
        await fetchLogsOnly();
        setNewCompetitorName('');
        setNewCompetitorId('');
        setShowAddCompetitor(false);
      }
    } catch (err) {
      console.error('Rakip ekleme hatası:', err);
    }
  };

  // Delete competitor
  const handleDeleteCompetitor = async (competitorName: string) => {
    try {
      const res = await api.delete(`/competitors/${competitorName}`);
      if (res.data.success) {
        const compRes = await api.get('/competitors');
        if (compRes.data.success) setCompetitors(compRes.data.data);
        await fetchLogsOnly();
      }
    } catch (err) {
      console.error('Rakip silme hatası:', err);
    }
  };

  // Add Repricer Rule
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;

    try {
      const res = await api.post('/rules', {
        name: newRuleName,
        type: newRuleType,
        limit: parseFloat(newRuleLimit) || 500,
        step: parseFloat(newRuleStep) || 1.00
      });

      if (res.data.success) {
        const [rulesRes, prodRes] = await Promise.all([
          api.get('/rules'),
          api.get('/products')
        ]);
        if (rulesRes.data.success) setRules(rulesRes.data.data);
        if (prodRes.data.success) setProducts(prodRes.data.data);
        await fetchLogsOnly();
        setNewRuleName('');
        setNewRuleLimit('');
        setNewRuleStep('');
        setShowAddRule(false);
      }
    } catch (err) {
      console.error('Kural ekleme hatası:', err);
    }
  };

  // Filter products by search query and buybox status
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBuybox = buyboxFilter === 'all' || !p.buybox;
    return matchesSearch && matchesBuybox;
  });

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      
      {/* 1. Shared Left Sidebar Navigation Component */}
      <DashboardSidebar />

      {/* 2. Main Work Panel (Viewport-Locked Layout) */}
      <main className="flex-1 p-3 sm:p-6 overflow-y-auto lg:overflow-hidden flex flex-col space-y-4 bg-[#070c16]">
        
        {/* Tab Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between shrink-0 gap-4 border-b border-white/[0.02] pb-4">
          <div>
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
              {activeTab === 'genel' && 'Analiz Paneli'}
              {activeTab === 'repricer' && 'Otomatik Fiyatlandırma'}
              {activeTab === 'rakip' && 'Rakip Analiz Raporu'}
              {activeTab === 'settings' && 'Entegrasyon Ayarları'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {activeTab === 'genel' && 'Satış ve Buybox Yönetimi'}
              {activeTab === 'repricer' && 'Akıllı Algoritma Kuralları'}
              {activeTab === 'rakip' && 'Takip Edilen Mağaza Rakipleri'}
              {activeTab === 'settings' && 'Trendyol API Kimlik Bilgileri'}
            </h1>
          </div>

          {/* Horizontal Sub-tabs selector */}
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.04] bg-[#0b1424] p-1 shrink-0 self-start md:self-center shadow-inner">
            <button 
              onClick={() => setActiveTab('genel')}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                activeTab === 'genel' 
                  ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/10' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
              }`}
            >
              Genel Durum
            </button>
            <button 
              onClick={() => setActiveTab('repricer')}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                activeTab === 'repricer' 
                  ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/10' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
              }`}
            >
              Hızlı Fiyat Ayarı
            </button>
            <button 
              onClick={() => setActiveTab('rakip')}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                activeTab === 'rakip' 
                  ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/10' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
              }`}
            >
              Rakip Takibi
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                activeTab === 'settings' 
                  ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/10' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
              }`}
            >
              Entegrasyon (API)
            </button>
          </div>
          
          {/* Quick Stats Summary */}
          <div className="flex items-center gap-3 bg-[#0b1424] border border-white/[0.04] p-1.5 sm:p-2 rounded-xl text-[10px] font-medium tracking-tight shrink-0 self-start md:self-center">
            <span className="flex items-center gap-1 text-slate-400">
              <Activity className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span>Durum:</span>
            </span>
            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider text-[9px]">Aktif</span>
          </div>
        </div>

        {/* -------------------- TAB CONTENT 1: GENEL DURUM -------------------- */}
        {activeTab === 'genel' && (
          <div className="flex-1 flex flex-col space-y-4 overflow-y-auto lg:overflow-hidden">
            
            {/* Top Interactive Metric Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
              <div className="bg-[#0b1424] border border-white/[0.04] p-3 rounded-xl flex items-center justify-between hover:border-brand-orange/20 transition-all select-none">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Bugünkü Satış</span>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                    ₺{dashboardStats ? dashboardStats.todaySales.toLocaleString('tr-TR', { minimumFractionDigits: 0 }) : '—'}
                  </div>
                </div>
                {dashboardStats && dashboardStats.todaySalesChange !== 0 ? (
                  <div className={`${dashboardStats.todaySalesChange > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} border px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5`}>
                    {dashboardStats.todaySalesChange > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span>{dashboardStats.todaySalesChange > 0 ? '+' : ''}{dashboardStats.todaySalesChange}%</span>
                  </div>
                ) : (
                  <div className="bg-white/[0.03] border border-white/[0.05] px-2 py-1 rounded-lg text-[9px] font-bold text-slate-400">Bugün</div>
                )}
              </div>

              <div className="bg-[#0b1424] border border-white/[0.04] p-3 rounded-xl flex items-center justify-between hover:border-brand-orange/20 transition-all select-none">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Kazanılan BuyBox</span>
                  <div className="text-base sm:text-lg font-black text-brand-orange tracking-tight mt-0.5">
                    {dashboardStats ? `%${dashboardStats.buyboxWinRate}` : '—'}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[9px] font-bold border ${
                  dashboardStats?.buyboxStatus === 'leading'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : dashboardStats?.buyboxStatus === 'losing'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-white/[0.03] border-white/[0.05] text-slate-400'
                }`}>
                  {dashboardStats?.buyboxStatus === 'leading' ? 'Lider' : dashboardStats?.buyboxStatus === 'losing' ? 'Geride' : '—'}
                </div>
              </div>

              <div className="bg-[#0b1424] border border-white/[0.04] p-3 rounded-xl flex items-center justify-between hover:border-brand-orange/20 transition-all select-none">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Aktif Repricer</span>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                    {dashboardStats ? `${dashboardStats.activeRepricerCount} Ürün` : '—'}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[9px] font-bold border ${
                  dashboardStats && dashboardStats.activeRepricerCount > 0
                    ? 'bg-brand-orange/10 border-brand-orange/20 text-brand-orange'
                    : 'bg-white/[0.03] border-white/[0.05] text-slate-400'
                }`}>
                  {dashboardStats && dashboardStats.activeRepricerCount > 0 ? 'İzleniyor' : 'Pasif'}
                </div>
              </div>

              <div className="bg-[#0b1424] border border-white/[0.04] p-3 rounded-xl flex items-center justify-between hover:border-brand-orange/20 transition-all select-none">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Fiyat Değişimi</span>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                    {dashboardStats ? `${dashboardStats.priceChangeCount} Kez` : '—'}
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.05] px-2 py-1 rounded-lg text-[9px] font-bold text-slate-400">
                  Bugün
                </div>
              </div>
            </div>



            {/* Bottom Section: Buybox Takip Listesi Table */}
            <div className="bg-[#0b1424] border border-white/[0.04] rounded-xl flex-1 flex flex-col overflow-hidden min-h-[280px] lg:min-h-0">
              
              {/* Table Controls (Search & Filter) */}
              <div className="p-3 border-b border-white/[0.04] bg-white/[0.01] flex flex-col xs:flex-row xs:items-center justify-between gap-3 shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">BuyBox Takip Listesi</span>
                  <div className="flex rounded-lg border border-white/[0.04] bg-[#070c16] p-0.5">
                    <button 
                      onClick={() => setBuyboxFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${buyboxFilter === 'all' ? 'bg-brand-orange text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Tümü
                    </button>
                    <button 
                      onClick={() => setBuyboxFilter('lost')}
                      className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${buyboxFilter === 'lost' ? 'bg-brand-orange text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Kaybedilenler
                    </button>
                  </div>
                </div>

                <div className="relative w-full xs:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Ürün ismi veya SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-[10px] pl-8 pr-3 py-1.5 rounded-lg border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Table wrapper */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#09101d] text-[9px] text-slate-400 font-bold uppercase tracking-wider sticky top-0 select-none z-10 border-b border-white/[0.03]">
                    <tr>
                      <th className="px-4 py-2.5">Ürün Bilgisi</th>
                      <th className="px-4 py-2.5 hidden sm:table-cell">Barkod/SKU</th>
                      <th className="px-4 py-2.5">Kendi Fiyatımız</th>
                      <th className="px-4 py-2.5">Rakip Fiyatı</th>
                      <th className="px-4 py-2.5">Durum</th>
                      <th className="px-4 py-2.5">Otomasyon</th>
                      <th className="px-4 py-2.5 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03] text-xs">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-500 text-[10px] font-semibold">
                          Eşleşen ürün bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[#13233F] border border-white/[0.04] flex items-center justify-center shrink-0 select-none">
                                <ShoppingBag className="w-4 h-4 text-brand-orange" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-200 truncate max-w-[120px] sm:max-w-[200px]">{p.name}</span>
                                <span className="text-[9px] text-slate-500 font-semibold font-mono sm:hidden">{p.sku}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[10px] font-semibold text-slate-400 font-mono hidden sm:table-cell">
                            {p.sku}
                          </td>
                          <td className="px-4 py-3 font-bold text-white">
                            ₺{p.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-slate-300 font-semibold">
                            ₺{p.competitorPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            {p.buybox ? (
                              <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full select-none inline-block border border-emerald-500/15">
                                Bizde
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-full select-none inline-block border border-brand-orange/15">
                                Rakipte
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleProductRepricerToggle(p.id)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-extrabold select-none transition-all ${p.repricerActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700/50'}`}
                            >
                              {p.repricerActive ? (
                                <>
                                  <Play className="w-2.5 h-2.5 fill-emerald-400" />
                                  <span>Aktif</span>
                                </>
                              ) : (
                                <>
                                  <Pause className="w-2.5 h-2.5 fill-slate-400" />
                                  <span>Duraklatıldı</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button 
                              onClick={() => setEditProduct(p)}
                              className="text-[10px] font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:bg-white/5 transition-all"
                            >
                              Düzenle
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {/* -------------------- TAB CONTENT 2: OTOMATİK FİYAT -------------------- */}
        {activeTab === 'repricer' && (
          <div className="flex-1 flex flex-col space-y-4 overflow-y-auto lg:overflow-hidden">
            
            {/* Rule Management Tools Header */}
            <div className="flex items-center justify-between shrink-0 select-none">
              <div className="text-xs text-slate-400 font-semibold">
                Fiyatlandırma motorunda çalışan güncel stratejiler
              </div>
              <button 
                onClick={() => setShowAddRule(true)}
                className="bg-brand-orange hover:bg-brand-orange-hover text-white text-[10px] font-extrabold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-brand-orange/10 transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Kural Ekle</span>
              </button>
            </div>

            {/* Rules Cards List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
              {rules.map((rule) => (
                <div 
                  key={rule.id} 
                  className={`bg-[#0b1424] border rounded-2xl p-4 flex flex-col justify-between space-y-4 hover:border-brand-orange/20 transition-all ${rule.isActive ? 'border-brand-orange/10' : 'border-white/[0.04]'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{rule.name}</h4>
                      <span className="text-[9px] font-mono text-slate-500 uppercase font-bold mt-1 block">
                        {rule.type === 'min-match' && 'En Düşük Fiyat Eşitleme'}
                        {rule.type === 'buybox-defense' && 'Buybox Koruma Standardı'}
                        {rule.type === 'stock-boost' && 'Düşük Stok Fiyat Yükseltici'}
                      </span>
                    </div>
                    
                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleRuleToggle(rule.id)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative ${rule.isActive ? 'bg-brand-orange' : 'bg-slate-800'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${rule.isActive ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </button>
                  </div>

                  <div className="space-y-1.5 text-[10px] text-slate-400 border-t border-white/[0.04] pt-3">
                    <div className="flex justify-between">
                      <span>Adım Fiyatı:</span>
                      <strong className="text-white">₺{rule.step}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Minimum Kâr Oranı:</span>
                      <strong className="text-white">%{rule.minMargin || 10}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.04] pt-3">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {rule.activeCount} Ürüne Tanımlı
                    </span>
                    <button className="text-[9px] font-bold text-slate-500 hover:text-red-400 hover:bg-red-500/5 px-2 py-1 rounded transition-colors select-none">
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Repricer Guide Section */}
            <div className="bg-[#0b1424] border border-white/[0.04] p-4 rounded-2xl flex-1 flex flex-col justify-between overflow-hidden min-h-[220px] lg:min-h-0">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">Akıllı Otomatik Fiyatlandırma Nasıl Çalışır?</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Sistemimiz Trendyol üzerindeki rakiplerinizin fiyat değişimlerini 7/24 kesintisiz takip eder. Tanımladığınız kurallara bağlı olarak, rakipleriniz fiyat kırdığında kendi fiyatınızı belirlediğiniz "Min Fiyat" sınırının altına düşmeyecek şekilde otomatik düşürür. Rakip fiyatı tekrar yükseldiğinde ise kar marjınızı maksimize etmek için fiyatınızı kural limitleri çerçevesinde tekrar yukarı çeker. Tüm işlemler Trendyol resmi API'si üzerinden milisaniyeler içinde yapılır.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 border-t border-white/[0.04] pt-4 text-[10px]">
                <div className="space-y-1">
                  <strong className="text-white block font-bold">1. Fiyat Kontrolü</strong>
                  <span className="text-slate-400">Trendyol'daki tüm rakip hareketleri saniyeler içinde taranır.</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-white block font-bold">2. Sınır Kontrolü</strong>
                  <span className="text-slate-400">Ürün için girdiğiniz Min ve Max fiyat marjları kontrol edilerek koruma sağlanır.</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-white block font-bold">3. Güvenli API Gönderimi</strong>
                  <span className="text-slate-400">Yeni hesaplanan güvenli fiyat Trendyol paneline şifreli API ile anında yansıtılır.</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* -------------------- TAB CONTENT 3: RAKİP TAKİBİ -------------------- */}
        {activeTab === 'rakip' && (
          <div className="flex-1 flex flex-col space-y-4 overflow-y-auto lg:overflow-hidden">
            
            <div className="flex items-center justify-between shrink-0 select-none">
              <div className="text-xs text-slate-400 font-semibold">
                Trendyol listelerinde sizinle ortak ürün satan rakipler
              </div>
              <button 
                onClick={() => setShowAddCompetitor(true)}
                className="bg-brand-orange hover:bg-brand-orange-hover text-white text-[10px] font-extrabold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-brand-orange/10 transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Rakip Mağaza Ekle</span>
              </button>
            </div>

            {/* Tracked Competitors Table Panel */}
            <div className="bg-[#0b1424] border border-white/[0.04] rounded-2xl flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#09101d] text-[9px] text-slate-400 font-bold uppercase tracking-wider sticky top-0 border-b border-white/[0.03] select-none">
                    <tr>
                      <th className="px-4 py-2.5">Rakip Mağaza İsmi</th>
                      <th className="px-4 py-2.5">Ortak Listelenen Ürün Sayısı</th>
                      <th className="px-4 py-2.5">BuyBox Başarı Oranı</th>
                      <th className="px-4 py-2.5">Son Senkronizasyon</th>
                      <th className="px-4 py-2.5 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03] text-xs">
                    {competitors.map((comp) => (
                      <tr key={comp.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-3 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-brand-orange shrink-0" />
                            <span>{comp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-300">
                          {comp.overlapCount} Ürün
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden hidden sm:block">
                              <div 
                                className="bg-brand-orange h-full rounded-full" 
                                style={{ width: `${comp.buyboxRate}%` }}
                              ></div>
                            </div>
                            <span className="font-bold text-white">%{comp.buyboxRate}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-semibold text-slate-400 font-mono">
                          {comp.updatedAt}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteCompetitor(comp.name)}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 transition-all select-none"
                          >
                            Takibi Bırak
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* -------------------- TAB CONTENT 4: ENTEGRASYON -------------------- */}
        {activeTab === 'settings' && (
          <div className="flex-1 flex flex-col space-y-4 overflow-y-auto lg:overflow-hidden">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
              
              {/* Credentials Settings Form */}
              <div className="bg-[#0b1424] border border-white/[0.04] rounded-2xl p-5 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 mb-2">
                    <Database className="w-4.5 h-4.5 text-brand-orange" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">API Bağlantı Parametreleri</span>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Trendyol satıcı paneli (Partner) üzerindeki Fiyat ve Stok entegrasyonlarını yapabilmek için API anahtarlarınızı girmeniz gerekmektedir. Bilgileriniz AES-256 şifreleme algoritması ile veritabanımızda son derece güvenle korunur.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase block">Satıcı ID (Seller ID)</label>
                      <input 
                        type="text" 
                        value={sellerId}
                        onChange={(e) => setSellerId(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-semibold font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase block">Trendyol API Key</label>
                      <input 
                        type="text" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-semibold font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase block">Trendyol API Secret</label>
                      <input 
                        type="password" 
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-semibold font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/[0.05] flex items-center justify-between gap-3">
                  <button 
                    onClick={triggerApiTest}
                    disabled={apiTesting}
                    className="flex-1 py-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/5 text-[10px] font-bold text-white transition-all flex items-center justify-center gap-1.5 select-none"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${apiTesting ? 'animate-spin' : ''}`} />
                    <span>Bağlantıyı Test Et</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setApiConnected(true);
                      setApiLogs(prev => [...prev, `[${new Date().toLocaleTimeString('tr-TR')}] AYARLAR: Entegrasyon ayarları kaydedildi.`]);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-[10px] font-extrabold text-white transition-all flex items-center justify-center gap-1.5 select-none shadow-lg shadow-brand-orange/15"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Ayarları Kaydet</span>
                  </button>
                </div>
              </div>

              {/* API Connection Live Sync Logs Console */}
              <div className="bg-[#0b1424] border border-white/[0.05] rounded-2xl flex flex-col justify-between overflow-hidden relative">
                
                <div className="px-4 py-3 bg-[#070e1a] border-b border-white/[0.04] flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-brand-orange" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Trendyol Senkronizasyon Konsolu</span>
                  </div>
                  
                  <span className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                </div>

                {/* Logs printed area */}
                <div className="flex-1 p-4 overflow-y-auto font-mono text-[9px] text-slate-400 space-y-2 select-text">
                  {apiLogs.map((log, index) => (
                    <div key={index} className="leading-relaxed whitespace-pre-wrap">
                      <span className="text-slate-500">&gt;</span> {log}
                    </div>
                  ))}
                  <div ref={logEndRef}></div>
                </div>

                <div className="p-3 bg-[#070e1a] border-t border-white/[0.04] text-[8px] text-slate-500 font-mono text-center select-none">
                  TrendAnaliz Fiyat Güncelleme Motoru v1.0.0
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* -------------------- MODAL 1: EDIT PRODUCT MARGINS -------------------- */}
      {editProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0b1424] p-5 shadow-2xl space-y-4 animate-scaleUp">
            
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-brand-orange" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Fiyat Limitlerini Düzenle</span>
              </div>
              <button 
                onClick={() => setEditProduct(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 select-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Seçilen Ürün</span>
              <p className="text-xs font-bold text-white leading-tight truncate">{editProduct.name}</p>
              <p className="text-[8px] text-slate-500 font-mono mt-0.5">{editProduct.sku}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase block select-none">Minimum Fiyat</label>
                <input 
                  type="number" 
                  value={editProduct.minPrice}
                  onChange={(e) => setEditProduct({ ...editProduct, minPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase block select-none">Maximum Fiyat</label>
                <input 
                  type="number" 
                  value={editProduct.maxPrice}
                  onChange={(e) => setEditProduct({ ...editProduct, maxPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase block select-none">Uygulanacak Repricer Stratejisi</label>
              <select 
                value={editProduct.rule}
                onChange={(e) => setEditProduct({ ...editProduct, rule: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-bold"
              >
                <option value="none">Strateji Uygulama (Pasif)</option>
                <option value="min-match">En Düşük Fiyat Eşitleme</option>
                <option value="buybox-defense">BuyBox Koruması (%15 En Düşük Marj)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-3">
              <button 
                onClick={() => setEditProduct(null)}
                className="flex-1 py-2 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/5 text-[10px] font-bold text-white transition-all select-none"
              >
                İptal
              </button>
              
              <button 
                onClick={handleSaveProductEdit}
                className="flex-1 py-2 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-[10px] font-extrabold text-white transition-all flex items-center justify-center gap-1.5 select-none shadow-lg"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Kaydet</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- MODAL 2: ADD COMPETITOR -------------------- */}
      {showAddCompetitor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleAddCompetitor}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0b1424] p-5 shadow-2xl space-y-4 animate-scaleUp"
          >
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
              <div className="flex items-center gap-1.5">
                <Store className="w-4 h-4 text-brand-orange" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">İzlenecek Yeni Mağaza</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddCompetitor(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase block select-none">Trendyol Mağaza Adı</label>
                <input 
                  type="text" 
                  placeholder="Örn: TeknoOutlet"
                  required
                  value={newCompetitorName}
                  onChange={(e) => setNewCompetitorName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase block select-none">Trendyol Satıcı ID (Seller ID)</label>
                <input 
                  type="text" 
                  placeholder="Örn: 123456"
                  value={newCompetitorId}
                  onChange={(e) => setNewCompetitorId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-semibold font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-3">
              <button 
                type="button"
                onClick={() => setShowAddCompetitor(false)}
                className="flex-1 py-2 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/5 text-[10px] font-bold text-white transition-all select-none"
              >
                İptal
              </button>
              
              <button 
                type="submit"
                className="flex-1 py-2 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-[10px] font-extrabold text-white transition-all flex items-center justify-center gap-1.5 select-none shadow-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>İzlemeyi Başlat</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* -------------------- MODAL 3: ADD REPRICER RULE -------------------- */}
      {showAddRule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleAddRule}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0b1424] p-5 shadow-2xl space-y-4 animate-scaleUp"
          >
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-brand-orange" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Yeni Repricer Kuralı</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddRule(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase block select-none">Kural İsmi</label>
                <input 
                  type="text" 
                  placeholder="Örn: Agresif BuyBox Koruması"
                  required
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase block select-none">Kural Tipi</label>
                <select 
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-bold"
                >
                  <option value="min-match">En Düşük Fiyat Eşitleme</option>
                  <option value="buybox-defense">BuyBox Koruması</option>
                  <option value="stock-boost">Düşük Stok Fiyat Yükseltme</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block select-none">Minimum Marj (%)</label>
                  <input 
                    type="number" 
                    placeholder="Örn: 15"
                    required
                    value={newRuleLimit}
                    onChange={(e) => setNewRuleLimit(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block select-none">Kırılma Adımı (₺)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    placeholder="Örn: 0.5"
                    required
                    value={newRuleStep}
                    onChange={(e) => setNewRuleStep(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-white/[0.05] bg-[#070c16] text-white focus:outline-none focus:border-brand-orange/40 transition-all font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-3">
              <button 
                type="button"
                onClick={() => setShowAddRule(false)}
                className="flex-1 py-2 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/5 text-[10px] font-bold text-white transition-all select-none"
              >
                İptal
              </button>
              
              <button 
                type="submit"
                className="flex-1 py-2 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-[10px] font-extrabold text-white transition-all flex items-center justify-center gap-1.5 select-none shadow-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kuralı Tanımla</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Decorative orange chart gradient definition for SVG fill */}
      <svg className="hidden">
        <defs>
          <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.0" />
          </linearGradient>
        </defs>
      </svg>

    </div>
  );
}
