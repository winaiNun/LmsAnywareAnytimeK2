-- Media/courses can also be aimed at teachers and school administrators (managed in the same list as the education levels).
INSERT INTO "EducationLevel" ("id", "slug", "name", "sortOrder") VALUES
  ('level_teacher', 'teacher',       'ครู',       5),
  ('level_admin',   'administrator', 'ผู้บริหาร', 6)
ON CONFLICT ("id") DO NOTHING;
