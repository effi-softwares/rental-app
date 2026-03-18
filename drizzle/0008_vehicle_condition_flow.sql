CREATE TYPE "public"."rental_condition_rating" AS ENUM('excellent', 'good', 'fair', 'poor');
--> statement-breakpoint
ALTER TABLE "rental_inspection" ADD COLUMN "condition_rating" "rental_condition_rating";
--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "latest_condition_snapshot" jsonb;