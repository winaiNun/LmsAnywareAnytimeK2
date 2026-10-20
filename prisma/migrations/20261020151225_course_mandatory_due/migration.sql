-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "mandatory" BOOLEAN NOT NULL DEFAULT false;
