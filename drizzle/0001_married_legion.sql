CREATE TYPE "public"."rental_installment_interval" AS ENUM('week', 'month');--> statement-breakpoint
CREATE TYPE "public"."rental_recurring_billing_state" AS ENUM('none', 'pending_setup', 'ready_to_schedule', 'scheduled_in_stripe', 'active_in_stripe', 'past_due', 'failed', 'cancelled');--> statement-breakpoint
ALTER TABLE "rental" ALTER COLUMN "installment_interval" SET DATA TYPE "public"."rental_installment_interval" USING "installment_interval"::text::"public"."rental_installment_interval";--> statement-breakpoint
ALTER TABLE "rental" ADD COLUMN "recurring_billing_state" "rental_recurring_billing_state" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_payment_schedule" ADD COLUMN "stripe_invoice_id" text;--> statement-breakpoint
ALTER TABLE "rental_payment_schedule" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "rental_payment_schedule" ADD COLUMN "failure_reason" text;--> statement-breakpoint
CREATE INDEX "rental_payment_schedule_stripe_invoice_id_idx" ON "rental_payment_schedule" USING btree ("stripe_invoice_id");