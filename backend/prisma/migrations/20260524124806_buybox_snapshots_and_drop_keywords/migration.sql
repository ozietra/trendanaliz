/*
  Warnings:

  - You are about to drop the `KeywordRanking` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "KeywordRanking" DROP CONSTRAINT "KeywordRanking_productId_fkey";

-- DropTable
DROP TABLE "KeywordRanking";

-- CreateTable
CREATE TABLE "BuyBoxSnapshot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyboxOrder" INTEGER NOT NULL,
    "buyboxPrice" DECIMAL(10,2) NOT NULL,
    "hasMultipleSeller" BOOLEAN NOT NULL DEFAULT false,
    "secondBuyboxPrice" DECIMAL(10,2),
    "thirdBuyboxPrice" DECIMAL(10,2),
    "ownPrice" DECIMAL(10,2),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyBoxSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuyBoxSnapshot_productId_checkedAt_idx" ON "BuyBoxSnapshot"("productId", "checkedAt");

-- CreateIndex
CREATE INDEX "BuyBoxSnapshot_checkedAt_idx" ON "BuyBoxSnapshot"("checkedAt");

-- AddForeignKey
ALTER TABLE "BuyBoxSnapshot" ADD CONSTRAINT "BuyBoxSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
