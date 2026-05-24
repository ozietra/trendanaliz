#!/bin/sh
set -e

echo "[entrypoint] Prisma migration deploy çalıştırılıyor..."
npx prisma migrate deploy || {
  echo "[entrypoint] UYARI: migration deploy başarısız. db push deniyorum..."
  npx prisma db push --accept-data-loss || true
}

if [ "$SEED_ON_START" = "1" ]; then
  echo "[entrypoint] Seed çalıştırılıyor..."
  npx prisma db seed || true
fi

echo "[entrypoint] Uygulama başlatılıyor..."
exec "$@"
