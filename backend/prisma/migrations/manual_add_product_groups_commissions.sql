-- AlterTable: Product'a categoryName sütunu ekle
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryName" TEXT;
CREATE INDEX IF NOT EXISTS "Product_categoryName_idx" ON "Product"("categoryName");

-- CreateTable: ProductGroup
CREATE TABLE IF NOT EXISTS "ProductGroup" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProductGroupItem
CREATE TABLE IF NOT EXISTS "ProductGroupItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductGroupItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CommissionRate
CREATE TABLE IF NOT EXISTS "CommissionRate" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductGroup_storeId_name_key" ON "ProductGroup"("storeId", "name");
CREATE INDEX IF NOT EXISTS "ProductGroup_storeId_idx" ON "ProductGroup"("storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductGroupItem_groupId_productId_key" ON "ProductGroupItem"("groupId", "productId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommissionRate_storeId_categoryName_key" ON "CommissionRate"("storeId", "categoryName");
CREATE INDEX IF NOT EXISTS "CommissionRate_storeId_idx" ON "CommissionRate"("storeId");

-- AddForeignKey
ALTER TABLE "ProductGroup" ADD CONSTRAINT "ProductGroup_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "TrendyolStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductGroupItem" ADD CONSTRAINT "ProductGroupItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductGroupItem" ADD CONSTRAINT "ProductGroupItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionRate" ADD CONSTRAINT "CommissionRate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "TrendyolStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
