ALTER TABLE "customer" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "customer_status_idx" ON "customer" USING btree ("status");