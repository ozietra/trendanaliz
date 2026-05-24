import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { HydrationProvider } from '../components/hydration-provider';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TrendAnaliz | Trendyol Satıcı Analiz ve Otomasyon Platformu',
  description:
    'Trendyol satıcıları için otomatik fiyat takibi, listing optimizasyonu, rakip analizleri ve satış öngörüleri sunan hepsi bir arada SaaS platformu.',
  keywords: 'trendyol satıcı panel, buybox takibi, rakip fiyat analizi, listing kalite skoru, trendanaliz',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${jakarta.variable} scroll-smooth`}>
      <body className="font-sans antialiased text-brand-navy bg-brand-gray">
        <HydrationProvider>{children}</HydrationProvider>
      </body>
    </html>
  );
}
