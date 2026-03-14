ALTER TYPE "public"."workspace_realtime_topic" RENAME VALUE 'billing' TO 'billing_attention';--> statement-breakpoint

UPDATE "organization_role"
SET "permission" = (
	(
		("permission"::jsonb - 'billing') ||
		jsonb_build_object(
			'payments',
			"permission"::jsonb -> 'billing',
			'billingAttention',
			"permission"::jsonb -> 'billing'
		)
	)::text
)
WHERE "permission"::jsonb ? 'billing';--> statement-breakpoint
