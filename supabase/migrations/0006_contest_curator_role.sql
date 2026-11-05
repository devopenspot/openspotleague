-- 0006: event_curator becomes contest_curator.
-- Editorial event CRUD is gone; curators now create and curate league
-- contests (create with a comped plan, edit, feature, hide, cancel) in their
-- country scopes. The role keeps its id, so user_roles assignments and
-- curator_country_scopes (keyed by user) carry over untouched.
-- Idempotent: on a fresh database the RBAC rows come from `pnpm db:seed`
-- (src/data/rbac.json) and these statements are no-ops.

INSERT INTO "permissions" ("slug", "name", "description")
VALUES (
  'league.curate',
  'Curate contests',
  'Create, edit, feature, hide and cancel league contests in scoped countries.'
)
ON CONFLICT ("slug") DO UPDATE
  SET "name" = excluded."name",
      "description" = excluded."description",
      "updated_at" = now();
--> statement-breakpoint
UPDATE "roles"
SET "slug" = 'contest_curator',
    "name" = 'Contest Curator',
    "description" = 'Create and curate league contests scoped by country.',
    "updated_at" = now()
WHERE "slug" = 'event_curator'
  AND NOT EXISTS (SELECT 1 FROM "roles" WHERE "slug" = 'contest_curator');
--> statement-breakpoint
-- The old editorial grants (content.write, taxonomy.use) no longer apply.
DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND r."slug" = 'contest_curator'
  AND p."slug" NOT IN ('content.read', 'media.manage', 'league.curate');
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p
  ON p."slug" IN ('content.read', 'media.manage', 'league.curate')
WHERE r."slug" = 'contest_curator'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."slug" = 'league.curate'
WHERE r."slug" = 'admin'
ON CONFLICT DO NOTHING;
