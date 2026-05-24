-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('Created', 'Picking', 'Invoiced', 'Shipped', 'ShippedToCollectionPoint', 'AtCollectionPoint', 'Delivered', 'UnDelivered', 'UnDeliveredAndReturned', 'Cancelled', 'Returned', 'Awaiting', 'UnSupplied', 'UnPacked', 'Repack');

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationPrefs" JSONB;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shipmentPackageId" BIGINT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "totalDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'TRY',
    "status" "OrderStatus" NOT NULL,
    "cargoTrackingNumber" TEXT,
    "cargoProviderName" TEXT,
    "cargoTrackingLink" TEXT,
    "customerFirstName" TEXT,
    "customerLastName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "tcIdentityNumber" TEXT,
    "taxNumber" TEXT,
    "invoiceAddress" JSONB,
    "shipmentAddress" JSONB,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "estimatedDeliveryStart" TIMESTAMP(3),
    "estimatedDeliveryEnd" TIMESTAMP(3),
    "fastDelivery" BOOLEAN NOT NULL DEFAULT false,
    "deliveryType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "lineId" BIGINT,
    "barcode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "merchantSku" TEXT,
    "productSize" TEXT,
    "productColor" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatBaseAmount" DECIMAL(12,2),
    "lineItemStatus" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_shipmentPackageId_key" ON "Order"("shipmentPackageId");

-- CreateIndex
CREATE INDEX "Order_storeId_orderDate_idx" ON "Order"("storeId", "orderDate");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_barcode_idx" ON "OrderItem"("barcode");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "TrendyolStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
