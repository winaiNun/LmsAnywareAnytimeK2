-- AlterEnum
ALTER TYPE "BlockKind" ADD VALUE 'HTML';

-- AlterTable
ALTER TABLE "LessonBlock" ADD COLUMN     "html" TEXT;
