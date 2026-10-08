-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "newTab" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "slideArrows" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slideAutoplay" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slideEffect" TEXT NOT NULL DEFAULT 'slide',
ADD COLUMN     "slideInterval" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN     "slideLayout" TEXT NOT NULL DEFAULT 'contained',
ADD COLUMN     "slideRadius" INTEGER NOT NULL DEFAULT 0;
