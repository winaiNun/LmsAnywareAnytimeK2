-- Watching is no longer measured: lessons finish by a confirmation button or by an "unlock question" (quiz).
DROP TABLE "BlockProgress";
ALTER TABLE "LessonBlock" DROP COLUMN "minPercent";
