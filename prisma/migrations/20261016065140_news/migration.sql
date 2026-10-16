-- CreateEnum
CREATE TYPE "NewsItemKind" AS ENUM ('LINK', 'FEED');

-- CreateTable
CREATE TABLE "NewsTab" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pageSize" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsTab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "kind" "NewsItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "publishedAt" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "feedLimit" INTEGER NOT NULL DEFAULT 20,
    "feedCacheMin" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsTab_active_sortOrder_idx" ON "NewsTab"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "NewsItem_tabId_active_idx" ON "NewsItem"("tabId", "active");

-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "NewsTab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
