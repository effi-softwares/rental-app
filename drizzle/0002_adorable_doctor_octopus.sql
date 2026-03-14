ALTER TABLE "user" ADD COLUMN "active_organization_id" uuid;--> statement-breakpoint
UPDATE "user" AS "target_user"
SET "active_organization_id" = "candidate_session"."active_organization_id"
FROM (
	SELECT DISTINCT ON ("user_id")
		"user_id",
		"active_organization_id"
	FROM "session"
	WHERE "active_organization_id" IS NOT NULL
	ORDER BY "user_id", "updated_at" DESC, "created_at" DESC
) AS "candidate_session"
WHERE
	"target_user"."id" = "candidate_session"."user_id"
	AND "target_user"."active_organization_id" IS NULL;--> statement-breakpoint
UPDATE "session"
SET "active_organization_id" = NULL
WHERE
	"active_organization_id" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "organization"
		WHERE "organization"."id" = "session"."active_organization_id"
	);--> statement-breakpoint
UPDATE "user"
SET "active_organization_id" = NULL
WHERE
	"active_organization_id" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "organization"
		WHERE "organization"."id" = "user"."active_organization_id"
	);--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_organization_id_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_active_organization_id_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
