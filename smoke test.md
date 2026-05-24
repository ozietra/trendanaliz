# 1) Migration uygula
cd c:\Users\oguzy\projects\mulk360\trendyol2\backend
npx prisma migrate dev --name sprint4_buybox_linkurl_drop_keywords

# 2) Tipler güncel mi?
npm run typecheck
npm test

# 3) Dev server'ı kaldır
npm run dev
# Yan terminal:
cd c:\Users\oguzy\projects\mulk360\trendyol2\frontend
npm run dev

# 4) Hızlı duman testi:
#   - http://localhost:3001/health/full         → status: ok
#   - http://localhost:3001/api/public/plans    → plan listesi
#   - http://localhost:3000/                    → landing
#   - Login → /dashboard
#   - Admin: /admin/kullanicilar → Demo butonu çalışıyor mu?