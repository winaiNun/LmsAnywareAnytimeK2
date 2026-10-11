-- Learning areas / media types keep an icon KEY (drawn as a line icon in the app) instead of an emoji.
-- Only rows that still hold an emoji are converted, so a key an admin already chose is never overwritten.
UPDATE "LearningArea" SET "icon" = CASE "id"
  WHEN 'area_thai' THEN 'book-open' WHEN 'area_math' THEN 'calculator' WHEN 'area_science' THEN 'flask'
  WHEN 'area_social' THEN 'globe' WHEN 'area_health' THEN 'activity' WHEN 'area_art' THEN 'palette'
  WHEN 'area_career' THEN 'wrench' WHEN 'area_foreign' THEN 'languages' WHEN 'area_activity' THEN 'users'
  WHEN 'area_teacher' THEN 'laptop' ELSE 'book-open' END
WHERE "icon" !~ '^[a-z][a-z-]*$';

UPDATE "MediaType" SET "icon" = CASE "id"
  WHEN 'type_video' THEN 'play-circle' WHEN 'type_doc' THEN 'file-text' WHEN 'type_worksheet' THEN 'clipboard-check'
  WHEN 'type_game' THEN 'gamepad' WHEN 'type_app' THEN 'app-window' WHEN 'type_slides' THEN 'presentation'
  WHEN 'type_plan' THEN 'calendar-check' WHEN 'type_book' THEN 'book' WHEN 'type_audio' THEN 'headphones'
  WHEN 'type_quiz' THEN 'help-circle' WHEN 'type_innovation' THEN 'lightbulb' ELSE 'file-text' END
WHERE "icon" !~ '^[a-z][a-z-]*$';
