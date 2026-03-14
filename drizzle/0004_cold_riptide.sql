CREATE TYPE "public"."rental_amendment_type" AS ENUM('schedule_change', 'extension', 'early_return');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_kind" AS ENUM('extension', 'damage', 'fine', 'toll', 'fuel', 'cleaning', 'late_return', 'other');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_status" AS ENUM('open', 'partially_paid', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rental_damage_category" AS ENUM('exterior', 'interior', 'mechanical', 'other');--> statement-breakpoint
CREATE TYPE "public"."rental_damage_repair_status" AS ENUM('reported', 'approved', 'repaired', 'waived');--> statement-breakpoint
CREATE TYPE "public"."rental_damage_severity" AS ENUM('minor', 'moderate', 'severe');--> statement-breakpoint
CREATE TYPE "public"."rental_deposit_event_type" AS ENUM('hold_collected', 'released', 'retained', 'applied_to_charge', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."rental_inspection_cleanliness" AS ENUM('clean', 'needs_attention', 'dirty');--> statement-breakpoint
CREATE TYPE "public"."rental_inspection_stage" AS ENUM('pickup', 'return');--> statement-breakpoint
CREATE TABLE "rental_amendment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"type" "rental_amendment_type" NOT NULL,
	"previous_planned_start_at" timestamp with time zone,
	"previous_planned_end_at" timestamp with time zone,
	"next_planned_start_at" timestamp with time zone,
	"next_planned_end_at" timestamp with time zone,
	"delta_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"pricing_snapshot_id" uuid,
	"reason" text,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_charge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"linked_damage_id" uuid,
	"linked_payment_id" uuid,
	"kind" "rental_charge_kind" NOT NULL,
	"status" "rental_charge_status" DEFAULT 'open' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"due_at" timestamp with time zone,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_damage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"inspection_id" uuid,
	"category" "rental_damage_category" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "rental_damage_severity" NOT NULL,
	"customer_liability_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"estimated_cost" numeric(12, 2),
	"actual_cost" numeric(12, 2),
	"repair_status" "rental_damage_repair_status" DEFAULT 'reported' NOT NULL,
	"media_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone,
	"repaired_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_deposit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"type" "rental_deposit_event_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"linked_charge_id" uuid,
	"linked_payment_id" uuid,
	"note" text,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_inspection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"stage" "rental_inspection_stage" NOT NULL,
	"odometer_km" numeric(12, 2),
	"fuel_percent" numeric(5, 2),
	"cleanliness" "rental_inspection_cleanliness",
	"checklist_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"signature_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"media_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_by_member_id" uuid,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rental_amendment" ADD CONSTRAINT "rental_amendment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_amendment" ADD CONSTRAINT "rental_amendment_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_amendment" ADD CONSTRAINT "rental_amendment_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_amendment" ADD CONSTRAINT "rental_amendment_pricing_snapshot_id_rental_pricing_snapshot_id_fk" FOREIGN KEY ("pricing_snapshot_id") REFERENCES "public"."rental_pricing_snapshot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_amendment" ADD CONSTRAINT "rental_amendment_created_by_member_id_member_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge" ADD CONSTRAINT "rental_charge_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge" ADD CONSTRAINT "rental_charge_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge" ADD CONSTRAINT "rental_charge_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge" ADD CONSTRAINT "rental_charge_linked_damage_id_rental_damage_id_fk" FOREIGN KEY ("linked_damage_id") REFERENCES "public"."rental_damage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge" ADD CONSTRAINT "rental_charge_linked_payment_id_rental_payment_id_fk" FOREIGN KEY ("linked_payment_id") REFERENCES "public"."rental_payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_damage" ADD CONSTRAINT "rental_damage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_damage" ADD CONSTRAINT "rental_damage_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_damage" ADD CONSTRAINT "rental_damage_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_damage" ADD CONSTRAINT "rental_damage_inspection_id_rental_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."rental_inspection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_deposit_event" ADD CONSTRAINT "rental_deposit_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_deposit_event" ADD CONSTRAINT "rental_deposit_event_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_deposit_event" ADD CONSTRAINT "rental_deposit_event_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_deposit_event" ADD CONSTRAINT "rental_deposit_event_linked_charge_id_rental_charge_id_fk" FOREIGN KEY ("linked_charge_id") REFERENCES "public"."rental_charge"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_deposit_event" ADD CONSTRAINT "rental_deposit_event_linked_payment_id_rental_payment_id_fk" FOREIGN KEY ("linked_payment_id") REFERENCES "public"."rental_payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_deposit_event" ADD CONSTRAINT "rental_deposit_event_created_by_member_id_member_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_inspection" ADD CONSTRAINT "rental_inspection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_inspection" ADD CONSTRAINT "rental_inspection_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_inspection" ADD CONSTRAINT "rental_inspection_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_inspection" ADD CONSTRAINT "rental_inspection_completed_by_member_id_member_id_fk" FOREIGN KEY ("completed_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_amendment_organization_id_idx" ON "rental_amendment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_amendment_branch_id_idx" ON "rental_amendment" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_amendment_rental_id_idx" ON "rental_amendment" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_amendment_type_idx" ON "rental_amendment" USING btree ("type");--> statement-breakpoint
CREATE INDEX "rental_charge_organization_id_idx" ON "rental_charge" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_charge_branch_id_idx" ON "rental_charge" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_charge_rental_id_idx" ON "rental_charge" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_charge_status_idx" ON "rental_charge" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rental_charge_payment_id_idx" ON "rental_charge" USING btree ("linked_payment_id");--> statement-breakpoint
CREATE INDEX "rental_damage_organization_id_idx" ON "rental_damage" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_damage_branch_id_idx" ON "rental_damage" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_damage_rental_id_idx" ON "rental_damage" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_damage_inspection_id_idx" ON "rental_damage" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "rental_damage_repair_status_idx" ON "rental_damage" USING btree ("repair_status");--> statement-breakpoint
CREATE INDEX "rental_deposit_event_organization_id_idx" ON "rental_deposit_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_deposit_event_branch_id_idx" ON "rental_deposit_event" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_deposit_event_rental_id_idx" ON "rental_deposit_event" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_deposit_event_charge_id_idx" ON "rental_deposit_event" USING btree ("linked_charge_id");--> statement-breakpoint
CREATE INDEX "rental_deposit_event_payment_id_idx" ON "rental_deposit_event" USING btree ("linked_payment_id");--> statement-breakpoint
CREATE INDEX "rental_inspection_organization_id_idx" ON "rental_inspection" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_inspection_branch_id_idx" ON "rental_inspection" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_inspection_rental_id_idx" ON "rental_inspection" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_inspection_stage_idx" ON "rental_inspection" USING btree ("stage");