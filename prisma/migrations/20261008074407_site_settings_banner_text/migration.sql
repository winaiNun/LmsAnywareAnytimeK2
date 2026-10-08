-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "showText" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "systemName" TEXT NOT NULL DEFAULT 'Anyware Anytime',
    "areaName" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',
    "logoKey" TEXT,
    "heroVideoKey" TEXT,
    "heroBgColor" TEXT NOT NULL DEFAULT '#0B2A6F',
    "overlayOpacity" INTEGER NOT NULL DEFAULT 45,
    "fadeSeconds" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);
