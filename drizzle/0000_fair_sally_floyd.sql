CREATE TYPE "public"."vehicle_telemetry_source" AS ENUM('mock', 'traccar');--> statement-breakpoint
CREATE TYPE "public"."vehicle_tracking_provider" AS ENUM('traccar', 'mock', 'custom');--> statement-breakpoint
CREATE TYPE "public"."rental_collection_timing" AS ENUM('setup', 'handover');--> statement-breakpoint
CREATE TYPE "public"."rental_invoice_collection_method" AS ENUM('charge_automatically', 'send_invoice', 'out_of_band');--> statement-breakpoint
CREATE TYPE "public"."rental_invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rental_payment_attempt_kind" AS ENUM('payment_method_setup', 'schedule_collection');--> statement-breakpoint
CREATE TYPE "public"."rental_payment_collection_surface" AS ENUM('cash_register', 'terminal_reader', 'direct_debit');--> statement-breakpoint
CREATE TYPE "public"."rental_payment_method_type" AS ENUM('cash', 'card', 'au_becs_debit');--> statement-breakpoint
CREATE TYPE "public"."rental_payment_plan_kind" AS ENUM('single', 'installment');--> statement-breakpoint
CREATE TYPE "public"."rental_payment_schedule_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rental_payment_status" AS ENUM('pending', 'requires_action', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rental_pricing_bucket" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "public"."rental_status" AS ENUM('draft', 'awaiting_payment', 'scheduled', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rental_stored_payment_method_status" AS ENUM('none', 'pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."distance_unit" AS ENUM('km', 'miles');--> statement-breakpoint
CREATE TYPE "public"."drivetrain" AS ENUM('FWD', 'RWD', 'AWD', '4WD', 'Electric-Single', 'Electric-Dual');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid', 'Hydrogen');--> statement-breakpoint
CREATE TYPE "public"."mileage_type" AS ENUM('Unlimited', 'Limited');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('Daily', 'Weekly', 'Monthly', 'Distance-Based');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('Automatic', 'Manual', 'Semi-Automatic');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('Available', 'Rented', 'Maintenance', 'Retired');--> statement-breakpoint
CREATE TYPE "public"."stripe_webhook_event_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."workspace_realtime_attention" AS ENUM('none', 'info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."workspace_realtime_topic" AS ENUM('billing', 'rentals');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	"is_visible" boolean DEFAULT true,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_role" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_organization_id" uuid,
	"impersonated_by" uuid,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"two_factor_enabled" boolean DEFAULT false,
	"requires_password_setup" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"stripe_terminal_location_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_branch_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"full_name" text NOT NULL,
	"email" text,
	"email_normalized" text,
	"phone" text,
	"phone_normalized" text,
	"stripe_customer_id" text,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"verification_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"author_member_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_live_position" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"device_id" uuid,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"speed_kph" double precision,
	"heading" double precision,
	"accuracy_meters" double precision,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "vehicle_telemetry_source" DEFAULT 'mock' NOT NULL,
	"attributes_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_position_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"device_id" uuid,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"speed_kph" double precision,
	"heading" double precision,
	"accuracy_meters" double precision,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "vehicle_telemetry_source" DEFAULT 'mock' NOT NULL,
	"attributes_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_tracking_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"provider" "vehicle_tracking_provider" DEFAULT 'custom' NOT NULL,
	"external_device_id" text NOT NULL,
	"display_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"created_by_user_id" uuid,
	"provider" text NOT NULL,
	"visibility" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pathname" text NOT NULL,
	"url" text NOT NULL,
	"download_url" text,
	"original_file_name" text,
	"content_type" text,
	"size_bytes" integer,
	"etag" text,
	"width" integer,
	"height" integer,
	"blur_data_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field" text DEFAULT 'default' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"vehicle_id" uuid,
	"customer_id" uuid,
	"status" "rental_status" DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"planned_start_at" timestamp with time zone,
	"planned_end_at" timestamp with time zone,
	"actual_start_at" timestamp with time zone,
	"actual_end_at" timestamp with time zone,
	"latest_pricing_snapshot_id" uuid,
	"pricing_bucket" "rental_pricing_bucket",
	"payment_plan_kind" "rental_payment_plan_kind" DEFAULT 'single' NOT NULL,
	"first_collection_timing" "rental_collection_timing" DEFAULT 'setup' NOT NULL,
	"installment_interval" "rental_pricing_bucket",
	"installment_count" integer,
	"selected_payment_method_type" "rental_payment_method_type",
	"stored_payment_method_status" "rental_stored_payment_method_status" DEFAULT 'none' NOT NULL,
	"deposit_required" boolean DEFAULT false NOT NULL,
	"deposit_amount" numeric(12, 2),
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_member_id" uuid,
	"updated_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_agreement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"template_version" text DEFAULT 'v1' NOT NULL,
	"document_hash" text,
	"signed_at" timestamp with time zone,
	"signed_by_member_id" uuid,
	"signature_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"status" "rental_invoice_status" DEFAULT 'draft' NOT NULL,
	"collection_method" "rental_invoice_collection_method" DEFAULT 'out_of_band' NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"stripe_invoice_id" text,
	"hosted_invoice_url" text,
	"invoice_pdf_url" text,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"deposit_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_invoice_line_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"schedule_id" uuid,
	"invoice_id" uuid,
	"kind" "rental_payment_attempt_kind" NOT NULL,
	"status" "rental_payment_status" DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"payment_method_type" "rental_payment_method_type",
	"collection_surface" "rental_payment_collection_surface",
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"manual_reference" text,
	"external_reference" text,
	"stripe_payment_intent_id" text,
	"stripe_setup_intent_id" text,
	"stripe_invoice_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_schedule_id" text,
	"stripe_payment_method_id" text,
	"stripe_charge_id" text,
	"idempotency_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_payment_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"label" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"status" "rental_payment_schedule_status" DEFAULT 'pending' NOT NULL,
	"payment_method_type" "rental_payment_method_type",
	"is_first_charge" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_pricing_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"rental_id" uuid NOT NULL,
	"pricing_bucket" "rental_pricing_bucket" NOT NULL,
	"unit_count" integer NOT NULL,
	"base_rate" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"deposit_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"grand_total" numeric(12, 2) NOT NULL,
	"line_items_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calc_version" text DEFAULT 'v1' NOT NULL,
	"calc_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"brand_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"body_type_id" uuid,
	"year" integer NOT NULL,
	"vin" text NOT NULL,
	"license_plate" text NOT NULL,
	"color" jsonb NOT NULL,
	"is_brand_new" boolean DEFAULT false NOT NULL,
	"transmission" "transmission" NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"drivetrain" "drivetrain" NOT NULL,
	"seats" integer NOT NULL,
	"doors" integer NOT NULL,
	"baggage_capacity" integer NOT NULL,
	"has_ac" boolean DEFAULT false NOT NULL,
	"has_navigation" boolean DEFAULT false NOT NULL,
	"has_bluetooth" boolean DEFAULT false NOT NULL,
	"is_pet_friendly" boolean DEFAULT false NOT NULL,
	"status" "vehicle_status" DEFAULT 'Available' NOT NULL,
	"registration_expiry_date" date NOT NULL,
	"insurance_expiry_date" date NOT NULL,
	"insurance_policy_number" text NOT NULL,
	"images" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"body_type_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"mileage_type" "mileage_type" NOT NULL,
	"limit_per_day" integer,
	"overage_fee_per_unit" numeric(12, 2),
	"measure_unit" "distance_unit" DEFAULT 'km',
	"requires_deposit" boolean DEFAULT false NOT NULL,
	"deposit_amount" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"branch_id" uuid,
	"stripe_event_id" text NOT NULL,
	"type" text NOT NULL,
	"mode" text NOT NULL,
	"api_version" text,
	"account_id" text,
	"object_type" text,
	"object_id" text,
	"status" "stripe_webhook_event_status" DEFAULT 'received' NOT NULL,
	"error_message" text,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_realtime_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"topic" "workspace_realtime_topic" NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"attention" "workspace_realtime_attention" DEFAULT 'none' NOT NULL,
	"summary" text,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_role" ADD CONSTRAINT "organization_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_branch_access" ADD CONSTRAINT "member_branch_access_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_branch_access" ADD CONSTRAINT "member_branch_access_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_branch_access" ADD CONSTRAINT "member_branch_access_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_author_member_id_member_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_live_position" ADD CONSTRAINT "vehicle_live_position_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_live_position" ADD CONSTRAINT "vehicle_live_position_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_live_position" ADD CONSTRAINT "vehicle_live_position_device_id_vehicle_tracking_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."vehicle_tracking_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_position_history" ADD CONSTRAINT "vehicle_position_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_position_history" ADD CONSTRAINT "vehicle_position_history_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_position_history" ADD CONSTRAINT "vehicle_position_history_device_id_vehicle_tracking_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."vehicle_tracking_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_tracking_device" ADD CONSTRAINT "vehicle_tracking_device_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_tracking_device" ADD CONSTRAINT "vehicle_tracking_device_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_link" ADD CONSTRAINT "media_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_link" ADD CONSTRAINT "media_link_asset_id_media_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_created_by_member_id_member_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_updated_by_member_id_member_id_fk" FOREIGN KEY ("updated_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_agreement" ADD CONSTRAINT "rental_agreement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_agreement" ADD CONSTRAINT "rental_agreement_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_agreement" ADD CONSTRAINT "rental_agreement_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_agreement" ADD CONSTRAINT "rental_agreement_signed_by_member_id_member_id_fk" FOREIGN KEY ("signed_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_event" ADD CONSTRAINT "rental_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_event" ADD CONSTRAINT "rental_event_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_event" ADD CONSTRAINT "rental_event_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_event" ADD CONSTRAINT "rental_event_actor_member_id_member_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_invoice" ADD CONSTRAINT "rental_invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_invoice" ADD CONSTRAINT "rental_invoice_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_invoice" ADD CONSTRAINT "rental_invoice_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_invoice_line_item" ADD CONSTRAINT "rental_invoice_line_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_invoice_line_item" ADD CONSTRAINT "rental_invoice_line_item_invoice_id_rental_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."rental_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment" ADD CONSTRAINT "rental_payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment" ADD CONSTRAINT "rental_payment_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment" ADD CONSTRAINT "rental_payment_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment" ADD CONSTRAINT "rental_payment_schedule_id_rental_payment_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."rental_payment_schedule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment" ADD CONSTRAINT "rental_payment_invoice_id_rental_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."rental_invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment_schedule" ADD CONSTRAINT "rental_payment_schedule_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment_schedule" ADD CONSTRAINT "rental_payment_schedule_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_payment_schedule" ADD CONSTRAINT "rental_payment_schedule_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_pricing_snapshot" ADD CONSTRAINT "rental_pricing_snapshot_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_pricing_snapshot" ADD CONSTRAINT "rental_pricing_snapshot_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_pricing_snapshot" ADD CONSTRAINT "rental_pricing_snapshot_rental_id_rental_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rental"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_brand_id_vehicle_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."vehicle_brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_model_id_vehicle_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_model"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_body_type_id_vehicle_type_id_fk" FOREIGN KEY ("body_type_id") REFERENCES "public"."vehicle_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_model" ADD CONSTRAINT "vehicle_model_brand_id_vehicle_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."vehicle_brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_model" ADD CONSTRAINT "vehicle_model_body_type_id_vehicle_type_id_fk" FOREIGN KEY ("body_type_id") REFERENCES "public"."vehicle_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_rate" ADD CONSTRAINT "vehicle_rate_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_rate" ADD CONSTRAINT "vehicle_rate_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_webhook_event" ADD CONSTRAINT "stripe_webhook_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_webhook_event" ADD CONSTRAINT "stripe_webhook_event_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_realtime_event" ADD CONSTRAINT "workspace_realtime_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_realtime_event" ADD CONSTRAINT "workspace_realtime_event_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizationRole_organizationId_idx" ON "organization_role" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organizationRole_role_idx" ON "organization_role" USING btree ("role");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "branch_organization_id_idx" ON "branch" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "branch_stripe_terminal_location_id_idx" ON "branch" USING btree ("stripe_terminal_location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_organization_code_uidx" ON "branch" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "member_branch_access_organization_id_idx" ON "member_branch_access" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_branch_access_branch_id_idx" ON "member_branch_access" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "member_branch_access_member_id_idx" ON "member_branch_access" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_branch_access_unique_member_branch" ON "member_branch_access" USING btree ("member_id","branch_id");--> statement-breakpoint
CREATE INDEX "customer_organization_id_idx" ON "customer" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_branch_id_idx" ON "customer" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "customer_email_normalized_idx" ON "customer" USING btree ("email_normalized");--> statement-breakpoint
CREATE INDEX "customer_phone_normalized_idx" ON "customer" USING btree ("phone_normalized");--> statement-breakpoint
CREATE INDEX "customer_stripe_customer_id_idx" ON "customer" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "customer_verification_status_idx" ON "customer" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "customer_note_organization_id_idx" ON "customer_note" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_note_customer_id_idx" ON "customer_note" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_note_author_member_id_idx" ON "customer_note" USING btree ("author_member_id");--> statement-breakpoint
CREATE INDEX "vehicle_live_position_org_idx" ON "vehicle_live_position" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vehicle_live_position_vehicle_idx" ON "vehicle_live_position" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_live_position_device_idx" ON "vehicle_live_position" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "vehicle_live_position_recorded_at_idx" ON "vehicle_live_position" USING btree ("recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_live_position_org_vehicle_uidx" ON "vehicle_live_position" USING btree ("organization_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_position_history_org_idx" ON "vehicle_position_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vehicle_position_history_vehicle_idx" ON "vehicle_position_history" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_position_history_device_idx" ON "vehicle_position_history" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "vehicle_position_history_vehicle_recorded_idx" ON "vehicle_position_history" USING btree ("organization_id","vehicle_id","recorded_at");--> statement-breakpoint
CREATE INDEX "vehicle_tracking_device_org_idx" ON "vehicle_tracking_device" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vehicle_tracking_device_vehicle_idx" ON "vehicle_tracking_device" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_tracking_device_provider_external_uidx" ON "vehicle_tracking_device" USING btree ("organization_id","provider","external_device_id");--> statement-breakpoint
CREATE INDEX "media_asset_organization_id_idx" ON "media_asset" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "media_asset_branch_id_idx" ON "media_asset" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "media_asset_status_idx" ON "media_asset" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_asset_created_by_user_id_idx" ON "media_asset" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_asset_org_pathname_uidx" ON "media_asset" USING btree ("organization_id","pathname");--> statement-breakpoint
CREATE INDEX "media_link_organization_id_idx" ON "media_link" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "media_link_asset_id_idx" ON "media_link" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "media_link_org_entity_field_sort_idx" ON "media_link" USING btree ("organization_id","entity_type","entity_id","field","sort_order");--> statement-breakpoint
CREATE INDEX "media_link_entity_lookup_idx" ON "media_link" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_link_unique_binding_uidx" ON "media_link" USING btree ("organization_id","asset_id","entity_type","entity_id","field");--> statement-breakpoint
CREATE INDEX "rental_organization_id_idx" ON "rental" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_branch_id_idx" ON "rental" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_vehicle_id_idx" ON "rental" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "rental_customer_id_idx" ON "rental" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "rental_status_idx" ON "rental" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rental_agreement_organization_id_idx" ON "rental_agreement" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_agreement_branch_id_idx" ON "rental_agreement" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_agreement_rental_id_uidx" ON "rental_agreement" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_event_organization_id_idx" ON "rental_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_event_branch_id_idx" ON "rental_event" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_event_rental_id_idx" ON "rental_event" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_invoice_organization_id_idx" ON "rental_invoice" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_invoice_branch_id_idx" ON "rental_invoice" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_invoice_rental_id_idx" ON "rental_invoice" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_invoice_status_idx" ON "rental_invoice" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rental_invoice_stripe_invoice_id_idx" ON "rental_invoice" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "rental_invoice_line_item_organization_id_idx" ON "rental_invoice_line_item" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_invoice_line_item_invoice_id_idx" ON "rental_invoice_line_item" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "rental_payment_organization_id_idx" ON "rental_payment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_payment_branch_id_idx" ON "rental_payment" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_payment_rental_id_idx" ON "rental_payment" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_payment_schedule_id_idx" ON "rental_payment" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "rental_payment_invoice_id_idx" ON "rental_payment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "rental_payment_status_idx" ON "rental_payment" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_payment_org_idempotency_uidx" ON "rental_payment" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "rental_payment_schedule_organization_id_idx" ON "rental_payment_schedule" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_payment_schedule_branch_id_idx" ON "rental_payment_schedule" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_payment_schedule_rental_id_idx" ON "rental_payment_schedule" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rental_payment_schedule_status_idx" ON "rental_payment_schedule" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_payment_schedule_rental_sequence_uidx" ON "rental_payment_schedule" USING btree ("rental_id","sequence");--> statement-breakpoint
CREATE INDEX "rental_pricing_snapshot_organization_id_idx" ON "rental_pricing_snapshot" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rental_pricing_snapshot_branch_id_idx" ON "rental_pricing_snapshot" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rental_pricing_snapshot_rental_id_idx" ON "rental_pricing_snapshot" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "vehicle_organization_id_idx" ON "vehicle" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vehicle_branch_id_idx" ON "vehicle" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "vehicle_status_idx" ON "vehicle" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_organization_vin_uidx" ON "vehicle" USING btree ("organization_id","vin");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_organization_license_uidx" ON "vehicle" USING btree ("organization_id","license_plate");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_brand_name_uidx" ON "vehicle_brand" USING btree ("name");--> statement-breakpoint
CREATE INDEX "vehicle_model_brand_id_idx" ON "vehicle_model" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_model_brand_name_uidx" ON "vehicle_model" USING btree ("brand_id","name");--> statement-breakpoint
CREATE INDEX "vehicle_rate_organization_id_idx" ON "vehicle_rate" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vehicle_rate_vehicle_id_idx" ON "vehicle_rate" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_rate_vehicle_pricing_model_uidx" ON "vehicle_rate" USING btree ("vehicle_id","pricing_model");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_type_name_uidx" ON "vehicle_type" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_event_stripe_event_id_uidx" ON "stripe_webhook_event" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_organization_id_idx" ON "stripe_webhook_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_branch_id_idx" ON "stripe_webhook_event" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_status_idx" ON "stripe_webhook_event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_type_idx" ON "stripe_webhook_event" USING btree ("type");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_object_id_idx" ON "stripe_webhook_event" USING btree ("object_id");--> statement-breakpoint
CREATE INDEX "workspace_realtime_event_organization_id_idx" ON "workspace_realtime_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_realtime_event_branch_id_idx" ON "workspace_realtime_event" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "workspace_realtime_event_topic_idx" ON "workspace_realtime_event" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "workspace_realtime_event_organization_topic_id_idx" ON "workspace_realtime_event" USING btree ("organization_id","topic","id");