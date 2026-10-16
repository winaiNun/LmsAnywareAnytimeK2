-- CreateTable
CREATE TABLE "StatCard" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "label" TEXT,
    "icon" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatCard_visible_sortOrder_idx" ON "StatCard"("visible", "sortOrder");

-- The four cards a site starts with (the admin can change, hide, reorder or delete them at แอดมิน › ตัวเลขสรุปหน้าแรก)
INSERT INTO "StatCard" ("id", "metric", "visible", "sortOrder") VALUES
  ('stat_default_media', 'media', true, 1),
  ('stat_default_courses', 'courses', true, 2),
  ('stat_default_creators', 'creators', true, 3),
  ('stat_default_students', 'students', true, 4);
