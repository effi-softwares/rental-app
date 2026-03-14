ALTER TABLE "workspace_realtime_event" ALTER COLUMN "topic" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."workspace_realtime_topic";--> statement-breakpoint
CREATE TYPE "public"."workspace_realtime_topic" AS ENUM('billing_attention', 'rentals');--> statement-breakpoint
ALTER TABLE "workspace_realtime_event" ALTER COLUMN "topic" SET DATA TYPE "public"."workspace_realtime_topic" USING "topic"::"public"."workspace_realtime_topic";