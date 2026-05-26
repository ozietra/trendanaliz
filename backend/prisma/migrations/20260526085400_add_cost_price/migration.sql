-- Add costPrice and shippingCost fields to Product table for profit/loss calculation
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(10,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingCost" DECIMAL(10,2);
