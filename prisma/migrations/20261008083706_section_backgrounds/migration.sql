-- AlterTable
ALTER TABLE "HomeSection" ADD COLUMN     "bgColor2" TEXT,
ADD COLUMN     "bgDirection" TEXT NOT NULL DEFAULT 'to right',
ADD COLUMN     "bgImageKey" TEXT,
ADD COLUMN     "bgMode" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "bgOverlay" INTEGER NOT NULL DEFAULT 0;
