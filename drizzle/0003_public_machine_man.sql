CREATE INDEX "rental_payment_org_created_at_idx" ON "rental_payment" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "rental_payment_org_status_created_at_idx" ON "rental_payment" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_org_received_at_idx" ON "stripe_webhook_event" USING btree ("organization_id","received_at");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_org_status_received_at_idx" ON "stripe_webhook_event" USING btree ("organization_id","status","received_at");