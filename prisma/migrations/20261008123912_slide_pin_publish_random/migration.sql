-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "slideRandom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slideShuffle" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
