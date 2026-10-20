-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MemberType" ADD VALUE 'SCHOOL_ADMIN';
ALTER TYPE "MemberType" ADD VALUE 'DISTRICT_STAFF';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "audienceOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "audienceTypes" "MemberType"[] DEFAULT ARRAY[]::"MemberType"[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "selfPublish" BOOLEAN NOT NULL DEFAULT false;
