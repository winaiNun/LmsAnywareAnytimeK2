-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('PENDING', 'ISSUED', 'REVOKED');

-- CreateTable
CREATE TABLE "CertificateSerial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pattern" TEXT NOT NULL DEFAULT '{no}/{year}',
    "padding" INTEGER NOT NULL DEFAULT 4,
    "nextNo" INTEGER NOT NULL DEFAULT 1,
    "resetYearly" BOOLEAN NOT NULL DEFAULT true,
    "lastYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateFont" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateFont_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateDesign" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "minScore" INTEGER,
    "imageDriveId" TEXT,
    "imageW" INTEGER NOT NULL DEFAULT 0,
    "imageH" INTEGER NOT NULL DEFAULT 0,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "serialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "serialId" TEXT,
    "number" TEXT,
    "status" "CertificateStatus" NOT NULL DEFAULT 'PENDING',
    "verifyCode" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "scorePercent" INTEGER,
    "nameSnapshot" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertificateDesign_courseId_idx" ON "CertificateDesign"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_verifyCode_key" ON "Certificate"("verifyCode");

-- CreateIndex
CREATE INDEX "Certificate_courseId_status_idx" ON "Certificate"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_courseId_userId_key" ON "Certificate"("courseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_serialId_number_key" ON "Certificate"("serialId", "number");

-- AddForeignKey
ALTER TABLE "CertificateDesign" ADD CONSTRAINT "CertificateDesign_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateDesign" ADD CONSTRAINT "CertificateDesign_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "CertificateSerial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_designId_fkey" FOREIGN KEY ("designId") REFERENCES "CertificateDesign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "CertificateSerial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
