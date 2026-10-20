-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "honorsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "honorsMinItems" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "honorsBio" TEXT,
ADD COLUMN     "honorsHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "honorsShowPhoto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "honorsShowSchool" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showInHonors" BOOLEAN NOT NULL DEFAULT false;
