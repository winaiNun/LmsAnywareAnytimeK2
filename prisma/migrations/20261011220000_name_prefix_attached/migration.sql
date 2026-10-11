-- Names are shown with the title attached to the first name ("นายวินัย หนุนกระโทก"), because the same string is printed on certificates.
-- Only rows still in the old format (prefix + space + first + space + last) are rewritten; hand-written display names are left alone.
UPDATE "User"
SET "name" = regexp_replace("prefix", '\s+', '', 'g') || "firstName" || ' ' || "lastName"
WHERE "prefix" IS NOT NULL AND "prefix" <> ''
  AND "firstName" IS NOT NULL AND "lastName" IS NOT NULL
  AND "name" = "prefix" || ' ' || "firstName" || ' ' || "lastName";
