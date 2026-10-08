-- CreateTable
CREATE TABLE "HomeSection" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "align" TEXT NOT NULL DEFAULT 'left',
    "titleSize" TEXT NOT NULL DEFAULT 'md',
    "titleColor" TEXT NOT NULL DEFAULT '#1E1E1E',
    "bgColor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSection_pkey" PRIMARY KEY ("key")
);
