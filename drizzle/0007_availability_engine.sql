CREATE TABLE "vehicle_class" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"body_type_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "vehicle_class" ADD CONSTRAINT "vehicle_class_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_class" ADD CONSTRAINT "vehicle_class_body_type_id_vehicle_type_id_fk" FOREIGN KEY ("body_type_id") REFERENCES "public"."vehicle_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_class_organization_id_idx" ON "vehicle_class" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_class_org_code_uidx" ON "vehicle_class" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_class_org_name_uidx" ON "vehicle_class" USING btree ("organization_id","name");--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "vehicle_class_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_vehicle_class_id_vehicle_class_id_fk" FOREIGN KEY ("vehicle_class_id") REFERENCES "public"."vehicle_class"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TYPE "public"."vehicle_availability_block_source" AS ENUM('rental', 'draft_hold', 'maintenance', 'prep_before', 'prep_after', 'manual_hold', 'blackout');--> statement-breakpoint
CREATE TYPE "public"."vehicle_availability_block_status" AS ENUM('active', 'released', 'cancelled');--> statement-breakpoint
CREATE TABLE "vehicle_availability_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"vehicle_id" uuid NOT NULL,
	"rental_id" uuid,
	"source_type" "vehicle_availability_block_source" DEFAULT 'manual_hold' NOT NULL,
	"status" "vehicle_availability_block_status" DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_member_id" uuid,
	"updated_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "vehicle_availability_block" ADD CONSTRAINT "vehicle_availability_block_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_availability_block" ADD CONSTRAINT "vehicle_availability_block_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_availability_block" ADD CONSTRAINT "vehicle_availability_block_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_availability_block" ADD CONSTRAINT "vehicle_availability_block_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_availability_block" ADD CONSTRAINT "vehicle_availability_block_created_by_member_id_member_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_availability_block" ADD CONSTRAINT "vehicle_availability_block_updated_by_member_id_member_id_fk" FOREIGN KEY ("updated_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_availability_block_org_idx" ON "vehicle_availability_block" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vehicle_availability_block_branch_idx" ON "vehicle_availability_block" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "vehicle_availability_block_vehicle_idx" ON "vehicle_availability_block" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_availability_block_rental_idx" ON "vehicle_availability_block" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "vehicle_availability_block_status_idx" ON "vehicle_availability_block" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicle_availability_block_expires_idx" ON "vehicle_availability_block" USING btree ("expires_at");--> statement-breakpoint
