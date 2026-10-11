-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "contactAddress" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "counterBase" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "counterSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "lineUrl" TEXT,
ADD COLUMN     "showOnline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showVisits" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "youtubeUrl" TEXT;

-- CreateTable
CREATE TABLE "SiteVisitDaily" (
    "day" DATE NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteVisitDaily_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "OnlinePing" (
    "sid" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlinePing_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "ResourceLink" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "groupName" TEXT NOT NULL DEFAULT 'ทั่วไป',
    "icon" TEXT NOT NULL DEFAULT 'globe',
    "color" TEXT NOT NULL DEFAULT '#0052FF',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePage" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "OnlinePing_seenAt_idx" ON "OnlinePing"("seenAt");

-- CreateIndex
CREATE INDEX "ResourceLink_active_sortOrder_idx" ON "ResourceLink"("active", "sortOrder");

