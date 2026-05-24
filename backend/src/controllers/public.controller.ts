import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

// Varsayılan/Fallback Fiyatlandırma Planları
const DEFAULT_PLANS = [
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
      'BuyBox ve Stok Bildirimleri (Email/SMS)',
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
      'Anlık Bildirimler (Email/SMS/SSE)',
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

/**
 * GET /api/public/plans
 * Aktif abonelik planlarını döndürür
 */
export const getPlans = async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    if (plans.length === 0) {
      // Veritabanı henüz seed edilmemişse fallback planlarını dön
      return res.json({
        success: true,
        data: DEFAULT_PLANS,
      });
    }

    return res.json({
      success: true,
      data: plans,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Planları getirme hatası: ${err.message}`);
    // Veritabanı hatası durumunda bile frontend çökmesin diye fallback planlarını dönüyoruz
    return res.json({
      success: true,
      data: DEFAULT_PLANS,
    });
  }
};

/**
 * GET /api/public/site-settings
 * Genel site ayarlarını döndürür
 */
export const getSiteSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.siteSettings.findMany();
    
    // settings verisini key-value map olarak düzenle
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, any>);

    return res.json({
      success: true,
      data: settingsMap,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Site ayarlarını getirme hatası: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Site ayarları yüklenemedi.',
    });
  }
};
