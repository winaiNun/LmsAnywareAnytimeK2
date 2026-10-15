-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "faqEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqUnanswered" (
    "id" TEXT NOT NULL,
    "norm" TEXT NOT NULL,
    "sample" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaqUnanswered_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FaqItem_active_sortOrder_idx" ON "FaqItem"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FaqUnanswered_norm_key" ON "FaqUnanswered"("norm");

-- CreateIndex
CREATE INDEX "FaqUnanswered_status_count_idx" ON "FaqUnanswered"("status", "count");
