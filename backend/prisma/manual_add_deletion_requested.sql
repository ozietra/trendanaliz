-- Production Migration: Add deletionRequestedAt to User table
-- Run this on Render PostgreSQL before deploying the new backend

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);
