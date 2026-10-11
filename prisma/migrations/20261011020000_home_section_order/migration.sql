-- The home page now has areas / latest / popular blocks. Keep the saved sections in the new default order
-- (recommended, areas, latest, popular, courses, schools) so the new blocks are not pushed to the bottom.
UPDATE "HomeSection" SET "sortOrder" = CASE "key" WHEN 'recommended' THEN 0 WHEN 'courses' THEN 4 WHEN 'schools' THEN 5 ELSE "sortOrder" END
WHERE "key" IN ('recommended', 'courses', 'schools');
