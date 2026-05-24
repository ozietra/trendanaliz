-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('IYZICO', 'PAYTR', 'IBAN', 'MANUAL');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'IYZICO',
ADD COLUMN     "providerMerchantOid" TEXT,
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "providerToken" TEXT;
