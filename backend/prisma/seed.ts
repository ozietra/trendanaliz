import { PrismaClient, BillingCycle, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Veritabanı tohumlama başlatılıyor...');

  // 1. Abonelik Planlarının Tohumlanması
  const plans = [
    {
      id: 'starter-plan-id',
      name: 'Starter',
      slug: 'starter',
      description: 'Yeni başlayan küçük ölçekli satıcılar için ideal başlangıç paketi.',
      price: 499.00,
      currency: 'TRY',
      billingCycle: BillingCycle.MONTHLY,
      maxProducts: 50,
      maxCompetitors: 5,
      refreshInterval: 120, // 120 dakika
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
      price: 999.00,
      currency: 'TRY',
      billingCycle: BillingCycle.MONTHLY,
      maxProducts: 250,
      maxCompetitors: 20,
      refreshInterval: 60, // 60 dakika
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
      price: 1999.00,
      currency: 'TRY',
      billingCycle: BillingCycle.MONTHLY,
      maxProducts: 99999,
      maxCompetitors: 99999,
      refreshInterval: 15, // 15 dakika
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

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        maxProducts: plan.maxProducts,
        maxCompetitors: plan.maxCompetitors,
        refreshInterval: plan.refreshInterval,
        features: plan.features,
        isActive: plan.isActive,
        isPopular: plan.isPopular,
        sortOrder: plan.sortOrder,
      },
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
    console.log(`Plan tohumlandı/güncellendi: ${plan.name}`);
  }

  // 2. Genel Site Ayarlarının Tohumlanması
  const defaultSettings = [
    { key: 'maintenance_mode', value: false },
    { key: 'allow_registrations', value: true },
    // NOT: trial_duration_days kaldırıldı — yeni kullanıcılar plan seçip
    // ödeme yaptıktan sonra doğrudan abonelik oluşturulur.
  ];

  for (const setting of defaultSettings) {
    await prisma.siteSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: {
        key: setting.key,
        value: setting.value,
      },
    });
    console.log(`Site ayarı tohumlandı/güncellendi: ${setting.key}`);
  }

  // 3. Süperadmin Kullanıcının Tohumlanması (env'den okur, yoksa varsayılan değer)
  const superadminEmail = process.env.SUPERADMIN_EMAIL || 'admin@trendanaliz.com';
  const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'Admin1234!';
  const superadminName = process.env.SUPERADMIN_NAME || 'Sistem Yöneticisi';

  const existingAdmin = await prisma.user.findUnique({ where: { email: superadminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(superadminPassword, 10);
    await prisma.user.create({
      data: {
        email: superadminEmail,
        passwordHash,
        name: superadminName,
        role: Role.SUPERADMIN,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`Süperadmin oluşturuldu: ${superadminEmail} (şifre: ${superadminPassword})`);
  } else if (existingAdmin.role !== Role.SUPERADMIN) {
    await prisma.user.update({
      where: { email: superadminEmail },
      data: { role: Role.SUPERADMIN },
    });
    console.log(`Mevcut kullanıcı süperadmin olarak güncellendi: ${superadminEmail}`);
  } else {
    console.log(`Süperadmin zaten mevcut: ${superadminEmail}`);
  }

  console.log('Veritabanı tohumlama başarıyla tamamlandı.');
}

main()
  .catch((e) => {
    console.error('Tohumlama hatası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
