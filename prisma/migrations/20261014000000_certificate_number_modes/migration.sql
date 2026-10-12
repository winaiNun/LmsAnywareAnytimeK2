-- CreateEnum
CREATE TYPE "CertificateNumberMode" AS ENUM ('MANUAL', 'AUTO');

-- AlterTable
ALTER TABLE "CertificateSerial" ADD COLUMN     "endNo" INTEGER,
ADD COLUMN     "mode" "CertificateNumberMode" NOT NULL DEFAULT 'MANUAL';
