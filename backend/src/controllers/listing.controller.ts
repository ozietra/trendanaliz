import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Listing Kalite Skoru
 * Her ürün için gerçek DB verisinden 0-100 arası bir skor hesaplar.
 * Kategoriler:
 *  - Başlık (uzunluk, anahtar kelime sayısı, sayı barındırma) — 25 puan
 *  - Fiyatlandırma (liste fiyatı vs satış fiyatı, indirim oranı) — 25 puan
 *  - Stok (stok > 0 ve makul aralıkta) — 15 puan
 *  - Buybox (sahipliği) — 20 puan
 *  - Rakip pozisyonu (en düşük rakibe yakınlık) — 15 puan
 * Öneriler eksik kategorilere göre üretilir.
 */

interface ScoredProduct {
  productId: string;
  title: string;
  barcode: string;
  score: number;
  breakdown: {
    title: number;
    price: number;
    stock: number;
    buybox: number;
    competitor: number;
  };
  suggestions: string[];
}

function scoreTitle(title: string): { score: number; suggestion?: string } {
  const len = title.length;
  let s = 0;
  if (len >= 30 && len <= 120) s += 15;
  else if (len >= 20 && len <= 150) s += 10;
  else s += 5;
  const words = title.split(/\s+/).filter((w) => w.length > 2);
  if (words.length >= 5) s += 7;
  else if (words.length >= 3) s += 4;
  if (/\d/.test(title)) s += 3; // Sayı içermesi (boyut/kapasite vs.) iyi
  s = Math.min(s, 25);
  const suggestion =
    len < 30
      ? 'Başlığı 30-120 karakter aralığına genişletin, marka/model/varyant ekleyin.'
      : len > 120
      ? 'Başlık çok uzun, ilk 120 karakter içine anahtar bilgileri sığdırın.'
      : undefined;
  return { score: s, suggestion };
}

function scorePrice(sale: number, list: number): { score: number; suggestion?: string } {
  if (list <= 0 || sale <= 0) {
    return { score: 5, suggestion: 'Liste ve satış fiyatlarını doldurun.' };
  }
  const discount = ((list - sale) / list) * 100;
  let s = 10;
  if (discount >= 10 && discount <= 50) s = 25; // Cazip indirim
  else if (discount >= 5 && discount < 10) s = 18;
  else if (discount > 50) s = 15; // Çok agresif, kâr riski
  const suggestion =
    discount < 5
      ? 'Liste fiyatınızı yükselterek %5-30 arası bir indirim oranı gösterin.'
      : discount > 50
      ? 'İndirim oranı çok yüksek; kâr marjınızı koruyacak şekilde liste fiyatını düşürün.'
      : undefined;
  return { score: s, suggestion };
}

function scoreStock(stock: number): { score: number; suggestion?: string } {
  if (stock <= 0) return { score: 0, suggestion: 'Stok 0 — ürün satışa çıkamaz, hızla yenileyin.' };
  if (stock < 5) return { score: 8, suggestion: 'Stok düşük; tükenme riski var, stoğu yükseltin.' };
  if (stock <= 200) return { score: 15 };
  return { score: 12, suggestion: 'Stok çok yüksek; depo maliyeti analiz edin.' };
}

function scoreBuybox(isBuybox: boolean): { score: number; suggestion?: string } {
  return isBuybox
    ? { score: 20 }
    : { score: 5, suggestion: 'Buybox kaybedilmiş; Repricer ile fiyat stratejisi devreye alın.' };
}

function scoreCompetitor(
  ourPrice: number,
  lowestComp: number | null
): { score: number; suggestion?: string } {
  if (lowestComp === null || lowestComp <= 0) {
    return { score: 10 };
  }
  const diff = ((ourPrice - lowestComp) / lowestComp) * 100;
  if (diff <= 0) return { score: 15 }; // bizim fiyatımız daha düşük/eşit
  if (diff <= 3) return { score: 12, suggestion: 'En ucuz rakibe çok yakınsınız; ±%2 farkta tutun.' };
  if (diff <= 10) return { score: 8, suggestion: 'Rakipten %10 pahalısınız; minimum fiyat sınırına yaklaşın.' };
  return { score: 3, suggestion: `Rakipten %${diff.toFixed(0)} pahalısınız; fiyatı düşürün.` };
}

/**
 * GET /api/listings/scores
 */
export const getListingScores = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });
    if (!store) {
      return res.json({ success: true, data: [], meta: { avgScore: 0, total: 0 } });
    }

    const products = await prisma.product.findMany({
      where: { storeId: store.id },
      include: { competitors: true },
    });

    const scored: ScoredProduct[] = products.map((p) => {
      const competitors = p.competitors || [];
      const lowestComp = competitors.length
        ? Math.min(...competitors.map((c) => Number(c.currentPrice)))
        : null;
      const isBuybox = lowestComp === null || Number(p.salePrice) <= lowestComp;

      const tScore = scoreTitle(p.title);
      const pScore = scorePrice(Number(p.salePrice), Number(p.listPrice));
      const sScore = scoreStock(p.stockCount);
      const bScore = scoreBuybox(isBuybox);
      const cScore = scoreCompetitor(Number(p.salePrice), lowestComp);

      const total = tScore.score + pScore.score + sScore.score + bScore.score + cScore.score;
      const suggestions = [
        tScore.suggestion,
        pScore.suggestion,
        sScore.suggestion,
        bScore.suggestion,
        cScore.suggestion,
      ].filter(Boolean) as string[];

      return {
        productId: p.id,
        title: p.title,
        barcode: p.barcode,
        score: total,
        breakdown: {
          title: tScore.score,
          price: pScore.score,
          stock: sScore.score,
          buybox: bScore.score,
          competitor: cScore.score,
        },
        suggestions,
      };
    });

    scored.sort((a, b) => a.score - b.score); // önce en düşük skorlular

    const avg = scored.length
      ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
      : 0;

    return res.json({
      success: true,
      data: scored,
      meta: { avgScore: avg, total: scored.length },
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Listing skor hatası: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Hesaplama başarısız.' });
  }
};
