CREATE TYPE "public"."rental_cancellation_reason" AS ENUM('customer_request', 'payment_issue', 'vehicle_unavailable', 'pricing_error', 'duplicate_booking', 'staff_error', 'other');--> statement-breakpoint
CREATE TYPE "public"."rental_payment_refund_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."rental_status" ADD VALUE 'cancelling' BEFORE 'active';--> statement-breakpoint
CREATE TABLE "rental_payment_refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"status" "rental_payment_refund_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"stripe_refund_id" text,
	"reference" text,
	"failure_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rental" ADD COLUMN "cancellation_reason" "rental_cancellation_reason";--> statement-breakpoint
ALTER TABLE "rental" ADD COLUMN "cancellation_note" text;--> statement-breakpoint
ALTER TABLE "rental" ADD COLUMN "cancellation_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental" ADD COLUMN "cancellation_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental" ADD COLUMN "cancellation_requested_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "rental" ADD COLUMN "cancellation_completed_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "rental_payment_refund" ADD CONSTRAINT "rental_payment_refund_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment_refund" ADD CONSTRAINT "rental_payment_refund_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment_refund" ADD CONSTRAINT "rental_payment_refund_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment_refund" ADD CONSTRAINT "rental_payment_refund_payment_id_rental_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."rental_payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment_refund" ADD CONSTRAINT "rental_payment_refund_confirmed_by_member_id_member_id_fk" FOREIGN KEY ("confirmed_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_payment_refund_organization_id_idx" ON "rental_payment_refund" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_payment_refund_branch_id_idx" ON "rental_payment_refund" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_payment_refund_rental_id_idx" ON "rental_payment_refund" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_payment_refund_payment_id_idx" ON "rental_payment_refund" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "rental_payment_refund_status_idx" ON "rental_payment_refund" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rental_payment_refund_stripe_refund_id_idx" ON "rental_payment_refund" USING btree ("stripe_refund_id");--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_cancellation_requested_by_member_id_member_id_fk" FOREIGN KEY ("cancellation_requested_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_cancellation_completed_by_member_id_member_id_fk" FOREIGN KEY ("cancellation_completed_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;