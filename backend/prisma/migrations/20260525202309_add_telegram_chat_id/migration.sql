-- Add Telegram chat ID field to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
