# ---- Build aşaması ----
FROM node:20-alpine AS builder
WORKDIR /app

# Sistem bağımlılıkları (bcrypt, sharp vb. için)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Çalışma aşaması ----
FROM node:20-alpine AS runner
WORKDIR /app

# Sağlık kontrolü için wget alpine'da hazır
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

# Sadece prod bağımlılıklar + seed'in çalışabilmesi için ts-node
RUN npm ci --omit=dev && \
    npm install --no-save ts-node@10 typescript@5 && \
    npm cache clean --force

# Build çıktısı ve Prisma istemcisi
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Giriş script'i: önce migrate, sonra uygulamayı başlat
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/app.js"]
