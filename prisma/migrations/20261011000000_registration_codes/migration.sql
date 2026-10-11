-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "requireRegistrationCode" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "registrationCodeId" TEXT;

-- CreateTable
CREATE TABLE "RegistrationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "memberType" "MemberType" NOT NULL,
    "schoolId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCode_code_key" ON "RegistrationCode"("code");

-- CreateIndex
CREATE INDEX "RegistrationCode_active_expiresAt_idx" ON "RegistrationCode"("active", "expiresAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_registrationCodeId_fkey" FOREIGN KEY ("registrationCodeId") REFERENCES "RegistrationCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCode" ADD CONSTRAINT "RegistrationCode_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

