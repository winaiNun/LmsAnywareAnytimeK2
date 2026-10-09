-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('STUDENT', 'TEACHER', 'SUPERVISOR', 'GENERAL');

-- CreateEnum
CREATE TYPE "CreatorStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creatorReason" TEXT,
ADD COLUMN     "creatorStatus" "CreatorStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "gradeLevel" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "memberType" "MemberType" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "prefix" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

