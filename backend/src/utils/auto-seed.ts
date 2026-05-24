import { prisma } from '../config/database';
import { BillingCycle } from '@prisma/client';
import { logger } from './logger';

/**
 * Sunucu başlarken veritabanında plan yoksa varsayılan planları oluşturur.
 * Bu, Render gibi platformlarda prisma db seed çalıştırılmadığında
 * planların otomatik olarak oluşturulmasını sağlar.
 */
export async function autoSeedPlans(): Promise<void> {
  try {
    const count = await prisma.plan.count();
    if (count > 0) {
      logger.info(`Veritabanında ${count} plan mevcut, seed atlanıyor.`);
      return;
    }

    logger.info('Veritabanında plan bulunamadı, varsayılan planlar oluşturuluyor...');

    const plans = [
      {
        id: 'starter-plan-id',
        name: 'Starter',
        slug: 'starter',
        description: 'Yeni başlayan küçük ölçekli satıcılar için ideal başlangıç paketi.',
        price: 499.0,
        currency: 'TRY',
        billingCycle: BillingCycle.MONTHLY,
        maxProducts: 50,
        maxCompetitors: 5,
        refreshInterval: 120,
        features: [
          '50 Ürün Takibi',
          '5 Rakip Takibi',
          '120 Dakika Güncelleme Sıklığı',
          'E-posta Bildirimleri',
          'Temel Listing Analizi',
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
        price: 999.0,
        currency: 'TRY',
        billingCycle: BillingCycle.MONTHLY,
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
          '7 Günlük Satış Tahmin Modeli',
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
        price: 1999.0,
        currency: 'TRY',
        billingCycle: BillingCycle.MONTHLY,
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
          '7/24 Öncelikli Canlı Destek',
        ],
        isActive: true,
        isPopular: false,
        sortOrder: 3,
      },
    ];

    for (const plan of plans) {
      await prisma.plan.upsert({
        where: { slug: plan.slug },
        update: {},
        create: {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          price: plan.price,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          maxProducts: plan.maxProducts,
          maxCompetitors: plan.maxCompetitors,
          refreshInterval: plan.refreshInterval,
          features: plan.features,
          isActive: plan.isActive,
          isPopular: plan.isPopular,
          sortOrder: plan.sortOrder,
        },
      });
      logger.info(`Plan oluşturuldu: ${plan.name}`);
    }

    // Varsayılan site ayarları
    const defaultSettings = [
      { key: 'payment.iyzico.enabled', value: true },
      { key: 'payment.paytr.enabled', value: true },
      { key: 'payment.iban.enabled', value: false },
    ];

    for (const setting of defaultSettings) {
      await prisma.siteSettings.upsert({
        where: { key: setting.key },
        update: {},
        create: { key: setting.key, value: setting.value },
      });
    }

    logger.info('Varsayılan planlar ve ayarlar başarıyla oluşturuldu.');
  } catch (error) {
    const err = error as Error;
    logger.error(`Auto-seed hatası: ${err.message}`);
    // Hata fırlatmıyoruz, sunucu yine de çalışmaya devam etsin
  }
}
