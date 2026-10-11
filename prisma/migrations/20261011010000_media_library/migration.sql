-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MediaItemKind" AS ENUM ('YOUTUBE', 'DRIVE_FILE', 'GOOGLE_DOC', 'APPS_SCRIPT', 'HTML', 'EMBED', 'LINK', 'UPLOAD');

-- DropForeignKey
ALTER TABLE "Book" DROP CONSTRAINT "Book_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "BookAuthor" DROP CONSTRAINT "BookAuthor_authorId_fkey";

-- DropForeignKey
ALTER TABLE "BookAuthor" DROP CONSTRAINT "BookAuthor_bookId_fkey";

-- DropForeignKey
ALTER TABLE "BookCopy" DROP CONSTRAINT "BookCopy_bookId_fkey";

-- DropForeignKey
ALTER TABLE "BookFile" DROP CONSTRAINT "BookFile_bookId_fkey";

-- DropForeignKey
ALTER TABLE "Loan" DROP CONSTRAINT "Loan_copyId_fkey";

-- DropForeignKey
ALTER TABLE "Loan" DROP CONSTRAINT "Loan_userId_fkey";

-- DropTable
DROP TABLE "Author";

-- DropTable
DROP TABLE "Book";

-- DropTable
DROP TABLE "BookAuthor";

-- DropTable
DROP TABLE "BookCopy";

-- DropTable
DROP TABLE "BookFile";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "Loan";

-- CreateTable
CREATE TABLE "LearningArea" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📖',
    "color" TEXT NOT NULL DEFAULT '#0052FF',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LearningArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📄',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MediaType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationLevel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EducationLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "authorName" TEXT,
    "areaId" TEXT NOT NULL,
    "typeId" TEXT,
    "tags" TEXT[],
    "coverKey" TEXT,
    "coverDriveId" TEXT,
    "coverFx" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "coverFy" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "MediaStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaLevel" (
    "mediaId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,

    CONSTRAINT "MediaLevel_pkey" PRIMARY KEY ("mediaId","levelId")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "kind" "MediaItemKind" NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "html" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaLike" (
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaLike_pkey" PRIMARY KEY ("userId","mediaId")
);

-- CreateTable
CREATE TABLE "MediaViewDaily" (
    "mediaId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MediaViewDaily_pkey" PRIMARY KEY ("mediaId","day")
);

-- CreateTable
CREATE TABLE "AreaReviewer" (
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "AreaReviewer_pkey" PRIMARY KEY ("userId","areaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningArea_slug_key" ON "LearningArea"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MediaType_slug_key" ON "MediaType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EducationLevel_slug_key" ON "EducationLevel"("slug");

-- CreateIndex
CREATE INDEX "Media_status_publishedAt_idx" ON "Media"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Media_areaId_status_idx" ON "Media"("areaId", "status");

-- CreateIndex
CREATE INDEX "Media_createdById_idx" ON "Media"("createdById");

-- CreateIndex
CREATE INDEX "Media_status_viewCount_idx" ON "Media"("status", "viewCount");

-- CreateIndex
CREATE INDEX "MediaItem_mediaId_sortOrder_idx" ON "MediaItem"("mediaId", "sortOrder");

-- CreateIndex
CREATE INDEX "MediaLike_mediaId_idx" ON "MediaLike"("mediaId");

-- CreateIndex
CREATE INDEX "MediaViewDaily_day_idx" ON "MediaViewDaily"("day");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "LearningArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "MediaType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLevel" ADD CONSTRAINT "MediaLevel_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLevel" ADD CONSTRAINT "MediaLevel_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "EducationLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLike" ADD CONSTRAINT "MediaLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLike" ADD CONSTRAINT "MediaLike_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaViewDaily" ADD CONSTRAINT "MediaViewDaily_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaReviewer" ADD CONSTRAINT "AreaReviewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaReviewer" ADD CONSTRAINT "AreaReviewer_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "LearningArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed: the 8 learning areas + 2 extras, media types, education levels (idempotent; admins can edit them afterwards)
INSERT INTO "LearningArea" ("id", "slug", "name", "icon", "color", "sortOrder") VALUES
  ('area_thai',     'thai',          'ภาษาไทย',                         '📖', '#E11D48', 1),
  ('area_math',     'math',          'คณิตศาสตร์',                       '🔢', '#2563EB', 2),
  ('area_science',  'science',       'วิทยาศาสตร์และเทคโนโลยี',          '🔬', '#059669', 3),
  ('area_social',   'social',        'สังคมศึกษา ศาสนาและวัฒนธรรม',      '🌏', '#D97706', 4),
  ('area_health',   'health',        'สุขศึกษาและพลศึกษา',               '🏃', '#DC2626', 5),
  ('area_art',      'art',           'ศิลปะ',                            '🎨', '#9333EA', 6),
  ('area_career',   'career',        'การงานอาชีพ',                      '🛠️', '#0891B2', 7),
  ('area_foreign',  'foreign',       'ภาษาต่างประเทศ',                   '🗣️', '#4F46E5', 8),
  ('area_activity', 'activity',      'กิจกรรมพัฒนาผู้เรียน',             '🤝', '#EA580C', 9),
  ('area_teacher',  'teacher-tech',  'เทคโนโลยีและการบริหารสำหรับครู',   '💻', '#475569', 10)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MediaType" ("id", "slug", "name", "icon", "sortOrder") VALUES
  ('type_video',      'video',      'วิดีโอ',                          '🎬', 1),
  ('type_doc',        'document',   'เอกสาร/ใบความรู้',                '📄', 2),
  ('type_worksheet',  'worksheet',  'ใบงาน/แบบฝึกหัด',                 '📝', 3),
  ('type_game',       'game',       'เกม/กิจกรรมโต้ตอบ',               '🎮', 4),
  ('type_app',        'app',        'แอปพลิเคชัน/สื่อปฏิสัมพันธ์',      '🧩', 5),
  ('type_slides',     'slides',     'สไลด์นำเสนอ',                     '📊', 6),
  ('type_plan',       'lesson-plan','แผนการจัดการเรียนรู้',            '🗂️', 7),
  ('type_book',       'book',       'หนังสือ/ePub/Flipbook',           '📚', 8),
  ('type_audio',      'audio',      'เสียง/พอดแคสต์',                  '🎧', 9),
  ('type_quiz',       'quiz',       'แบบทดสอบ/ข้อสอบ',                 '❓', 10),
  ('type_innovation', 'innovation', 'นวัตกรรม/งานวิจัย (สำหรับครู)',   '💡', 11)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "EducationLevel" ("id", "slug", "name", "sortOrder") VALUES
  ('level_kg',      'kindergarten',     'อนุบาล',                  1),
  ('level_primary', 'primary',          'ประถมศึกษา',              2),
  ('level_lower',   'lower-secondary',  'มัธยมศึกษาตอนต้น',        3),
  ('level_upper',   'upper-secondary',  'มัธยมศึกษาตอนปลาย',       4)
ON CONFLICT ("id") DO NOTHING;

-- The old demo home-page blocks for the book mock-up are gone: drop their saved settings.
DELETE FROM "HomeSection" WHERE "key" IN ('categories', 'media');
