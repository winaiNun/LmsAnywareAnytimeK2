-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "registrationApproval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingApproval" BOOLEAN NOT NULL DEFAULT false;
