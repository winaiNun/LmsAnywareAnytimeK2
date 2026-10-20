-- AlterTable
ALTER TABLE "RegistrationCode" ADD COLUMN     "groupUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "RegistrationCode_parentId_idx" ON "RegistrationCode"("parentId");

-- AddForeignKey
ALTER TABLE "RegistrationCode" ADD CONSTRAINT "RegistrationCode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RegistrationCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing codes are all top-level: their group total is their own usage.
UPDATE "RegistrationCode" SET "groupUsed" = "usedCount";
