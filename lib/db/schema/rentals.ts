import { relations } from "drizzle-orm"
import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"

import { member, organization } from "./auth"
import { branch } from "./branches"
import { customer } from "./customers"
import { vehicle } from "./vehicles"

export const rentalStatusEnum = pgEnum("rental_status", [
	"draft",
	"awaiting_payment",
	"scheduled",
	"active",
	"completed",
	"cancelled",
])

export const rentalPricingBucketEnum = pgEnum("rental_pricing_bucket", [
	"day",
	"week",
	"month",
])

export const rentalPaymentPlanKindEnum = pgEnum("rental_payment_plan_kind", [
	"single",
	"installment",
])

export const rentalCollectionTimingEnum = pgEnum("rental_collection_timing", [
	"setup",
	"handover",
])

export const rentalInstallmentIntervalEnum = pgEnum(
	"rental_installment_interval",
	["week", "month"],
)

export const rentalStoredPaymentMethodStatusEnum = pgEnum(
	"rental_stored_payment_method_status",
	["none", "pending", "ready", "failed"],
)

export const rentalRecurringBillingStateEnum = pgEnum(
	"rental_recurring_billing_state",
	[
		"none",
		"pending_setup",
		"ready_to_schedule",
		"scheduled_in_stripe",
		"active_in_stripe",
		"past_due",
		"failed",
		"cancelled",
	],
)

export const rentalPaymentScheduleStatusEnum = pgEnum(
	"rental_payment_schedule_status",
	["pending", "processing", "succeeded", "failed", "cancelled"],
)

export const rentalPaymentAttemptKindEnum = pgEnum(
	"rental_payment_attempt_kind",
	["payment_method_setup", "schedule_collection"],
)

export const rentalPaymentStatusEnum = pgEnum("rental_payment_status", [
	"pending",
	"requires_action",
	"processing",
	"succeeded",
	"failed",
	"refunded",
	"cancelled",
])

export const rentalPaymentMethodTypeEnum = pgEnum(
	"rental_payment_method_type",
	["cash", "card", "au_becs_debit"],
)

export const rentalPaymentCollectionSurfaceEnum = pgEnum(
	"rental_payment_collection_surface",
	["cash_register", "terminal_reader", "direct_debit"],
)

export const rentalInspectionStageEnum = pgEnum("rental_inspection_stage", [
	"pickup",
	"return",
])

export const rentalInspectionCleanlinessEnum = pgEnum(
	"rental_inspection_cleanliness",
	["clean", "needs_attention", "dirty"],
)

export const rentalDamageCategoryEnum = pgEnum("rental_damage_category", [
	"exterior",
	"interior",
	"mechanical",
	"other",
])

export const rentalDamageSeverityEnum = pgEnum("rental_damage_severity", [
	"minor",
	"moderate",
	"severe",
])

export const rentalDamageRepairStatusEnum = pgEnum(
	"rental_damage_repair_status",
	["reported", "approved", "repaired", "waived"],
)

export const rentalChargeKindEnum = pgEnum("rental_charge_kind", [
	"extension",
	"damage",
	"fine",
	"toll",
	"fuel",
	"cleaning",
	"late_return",
	"other",
])

export const rentalChargeStatusEnum = pgEnum("rental_charge_status", [
	"open",
	"partially_paid",
	"paid",
	"cancelled",
])

export const rentalDepositEventTypeEnum = pgEnum("rental_deposit_event_type", [
	"hold_collected",
	"released",
	"retained",
	"applied_to_charge",
	"refunded",
])

export const rentalAmendmentTypeEnum = pgEnum("rental_amendment_type", [
	"schedule_change",
	"extension",
	"early_return",
])

export const rentalInvoiceStatusEnum = pgEnum("rental_invoice_status", [
	"draft",
	"open",
	"paid",
	"void",
	"uncollectible",
	"cancelled",
])

export const rentalInvoiceCollectionMethodEnum = pgEnum(
	"rental_invoice_collection_method",
	["charge_automatically", "send_invoice", "out_of_band"],
)

export const vehicleAvailabilityBlockSourceEnum = pgEnum(
	"vehicle_availability_block_source",
	[
		"rental",
		"draft_hold",
		"maintenance",
		"prep_before",
		"prep_after",
		"manual_hold",
		"blackout",
	],
)

export const vehicleAvailabilityBlockStatusEnum = pgEnum(
	"vehicle_availability_block_status",
	["active", "released", "cancelled"],
)

export const rental = pgTable(
	"rental",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		vehicleId: uuid("vehicle_id").references(() => vehicle.id, {
			onDelete: "set null",
		}),
		customerId: uuid("customer_id").references(() => customer.id, {
			onDelete: "set null",
		}),
		status: rentalStatusEnum("status").default("draft").notNull(),
		currency: text("currency").default("AUD").notNull(),
		plannedStartAt: timestamp("planned_start_at", { withTimezone: true }),
		plannedEndAt: timestamp("planned_end_at", { withTimezone: true }),
		actualStartAt: timestamp("actual_start_at", { withTimezone: true }),
		actualEndAt: timestamp("actual_end_at", { withTimezone: true }),
		latestPricingSnapshotId: uuid("latest_pricing_snapshot_id"),
		pricingBucket: rentalPricingBucketEnum("pricing_bucket"),
		paymentPlanKind: rentalPaymentPlanKindEnum("payment_plan_kind")
			.default("single")
			.notNull(),
		firstCollectionTiming: rentalCollectionTimingEnum("first_collection_timing")
			.default("setup")
			.notNull(),
		installmentInterval: rentalInstallmentIntervalEnum("installment_interval"),
		installmentCount: integer("installment_count"),
		selectedPaymentMethodType: rentalPaymentMethodTypeEnum(
			"selected_payment_method_type",
		),
		storedPaymentMethodStatus: rentalStoredPaymentMethodStatusEnum(
			"stored_payment_method_status",
		)
			.default("none")
			.notNull(),
		recurringBillingState: rentalRecurringBillingStateEnum(
			"recurring_billing_state",
		)
			.default("none")
			.notNull(),
		depositRequired: boolean("deposit_required").default(false).notNull(),
		depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }),
		notes: text("notes"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		version: integer("version").default(1).notNull(),
		createdByMemberId: uuid("created_by_member_id").references(
			() => member.id,
			{
				onDelete: "set null",
			},
		),
		updatedByMemberId: uuid("updated_by_member_id").references(
			() => member.id,
			{
				onDelete: "set null",
			},
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_organization_id_idx").on(table.organizationId),
		index("rental_branch_id_idx").on(table.branchId),
		index("rental_vehicle_id_idx").on(table.vehicleId),
		index("rental_customer_id_idx").on(table.customerId),
		index("rental_status_idx").on(table.status),
	],
)

export const rentalInvoice = pgTable(
	"rental_invoice",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		status: rentalInvoiceStatusEnum("status").default("draft").notNull(),
		collectionMethod: rentalInvoiceCollectionMethodEnum("collection_method")
			.default("out_of_band")
			.notNull(),
		currency: text("currency").default("AUD").notNull(),
		stripeInvoiceId: text("stripe_invoice_id"),
		hostedInvoiceUrl: text("hosted_invoice_url"),
		invoicePdfUrl: text("invoice_pdf_url"),
		subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
		discountTotal: numeric("discount_total", { precision: 12, scale: 2 })
			.default("0.00")
			.notNull(),
		taxTotal: numeric("tax_total", { precision: 12, scale: 2 })
			.default("0.00")
			.notNull(),
		depositTotal: numeric("deposit_total", { precision: 12, scale: 2 })
			.default("0.00")
			.notNull(),
		total: numeric("total", { precision: 12, scale: 2 }).notNull(),
		issuedAt: timestamp("issued_at", { withTimezone: true }),
		dueAt: timestamp("due_at", { withTimezone: true }),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_invoice_organization_id_idx").on(table.organizationId),
		index("rental_invoice_branch_id_idx").on(table.branchId),
		index("rental_invoice_rental_id_idx").on(table.rentalId),
		index("rental_invoice_status_idx").on(table.status),
		index("rental_invoice_stripe_invoice_id_idx").on(table.stripeInvoiceId),
	],
)

export const rentalInvoiceLineItem = pgTable(
	"rental_invoice_line_item",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		invoiceId: uuid("invoice_id")
			.notNull()
			.references(() => rentalInvoice.id, { onDelete: "cascade" }),
		code: text("code").notNull(),
		label: text("label").notNull(),
		quantity: integer("quantity").default(1).notNull(),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		type: text("type").notNull(),
		sortOrder: integer("sort_order").default(0).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_invoice_line_item_organization_id_idx").on(
			table.organizationId,
		),
		index("rental_invoice_line_item_invoice_id_idx").on(table.invoiceId),
	],
)

export const rentalPricingSnapshot = pgTable(
	"rental_pricing_snapshot",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		pricingBucket: rentalPricingBucketEnum("pricing_bucket").notNull(),
		unitCount: integer("unit_count").notNull(),
		baseRate: numeric("base_rate", { precision: 12, scale: 2 }).notNull(),
		subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
		discountTotal: numeric("discount_total", { precision: 12, scale: 2 })
			.default("0.00")
			.notNull(),
		taxTotal: numeric("tax_total", { precision: 12, scale: 2 })
			.default("0.00")
			.notNull(),
		depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 })
			.default("0.00")
			.notNull(),
		grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull(),
		lineItemsJson: jsonb("line_items_json")
			.$type<
				Array<{
					code: string
					label: string
					amount: number
					quantity?: number
					type: "charge" | "tax" | "discount" | "deposit"
				}>
			>()
			.default([])
			.notNull(),
		calcVersion: text("calc_version").default("v1").notNull(),
		calcHash: text("calc_hash").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_pricing_snapshot_organization_id_idx").on(
			table.organizationId,
		),
		index("rental_pricing_snapshot_branch_id_idx").on(table.branchId),
		index("rental_pricing_snapshot_rental_id_idx").on(table.rentalId),
	],
)

export const rentalPaymentSchedule = pgTable(
	"rental_payment_schedule",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		sequence: integer("sequence").notNull(),
		label: text("label").notNull(),
		dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		currency: text("currency").default("AUD").notNull(),
		status: rentalPaymentScheduleStatusEnum("status")
			.default("pending")
			.notNull(),
		paymentMethodType: rentalPaymentMethodTypeEnum("payment_method_type"),
		isFirstCharge: boolean("is_first_charge").default(false).notNull(),
		stripeInvoiceId: text("stripe_invoice_id"),
		stripeSubscriptionId: text("stripe_subscription_id"),
		failureReason: text("failure_reason"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		settledAt: timestamp("settled_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_payment_schedule_organization_id_idx").on(
			table.organizationId,
		),
		index("rental_payment_schedule_branch_id_idx").on(table.branchId),
		index("rental_payment_schedule_rental_id_idx").on(table.rentalId),
		index("rental_payment_schedule_status_idx").on(table.status),
		index("rental_payment_schedule_stripe_invoice_id_idx").on(
			table.stripeInvoiceId,
		),
		uniqueIndex("rental_payment_schedule_rental_sequence_uidx").on(
			table.rentalId,
			table.sequence,
		),
	],
)

export const rentalPayment = pgTable(
	"rental_payment",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		scheduleId: uuid("schedule_id").references(() => rentalPaymentSchedule.id, {
			onDelete: "set null",
		}),
		invoiceId: uuid("invoice_id").references(() => rentalInvoice.id, {
			onDelete: "set null",
		}),
		kind: rentalPaymentAttemptKindEnum("kind").notNull(),
		status: rentalPaymentStatusEnum("status").default("pending").notNull(),
		provider: text("provider").default("stripe").notNull(),
		paymentMethodType: rentalPaymentMethodTypeEnum("payment_method_type"),
		collectionSurface: rentalPaymentCollectionSurfaceEnum("collection_surface"),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		currency: text("currency").default("AUD").notNull(),
		manualReference: text("manual_reference"),
		externalReference: text("external_reference"),
		stripePaymentIntentId: text("stripe_payment_intent_id"),
		stripeSetupIntentId: text("stripe_setup_intent_id"),
		stripeInvoiceId: text("stripe_invoice_id"),
		stripeSubscriptionId: text("stripe_subscription_id"),
		stripeSubscriptionScheduleId: text("stripe_subscription_schedule_id"),
		stripePaymentMethodId: text("stripe_payment_method_id"),
		stripeChargeId: text("stripe_charge_id"),
		idempotencyKey: text("idempotency_key"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		capturedAt: timestamp("captured_at", { withTimezone: true }),
		refundedAt: timestamp("refunded_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_payment_organization_id_idx").on(table.organizationId),
		index("rental_payment_branch_id_idx").on(table.branchId),
		index("rental_payment_rental_id_idx").on(table.rentalId),
		index("rental_payment_schedule_id_idx").on(table.scheduleId),
		index("rental_payment_invoice_id_idx").on(table.invoiceId),
		index("rental_payment_status_idx").on(table.status),
		index("rental_payment_org_created_at_idx").on(
			table.organizationId,
			table.createdAt,
		),
		index("rental_payment_org_status_created_at_idx").on(
			table.organizationId,
			table.status,
			table.createdAt,
		),
		uniqueIndex("rental_payment_org_idempotency_uidx").on(
			table.organizationId,
			table.idempotencyKey,
		),
	],
)

export const rentalAgreement = pgTable(
	"rental_agreement",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		templateVersion: text("template_version").default("v1").notNull(),
		documentHash: text("document_hash"),
		signedAt: timestamp("signed_at", { withTimezone: true }),
		signedByMemberId: uuid("signed_by_member_id").references(() => member.id, {
			onDelete: "set null",
		}),
		signaturePayload: jsonb("signature_payload")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_agreement_organization_id_idx").on(table.organizationId),
		index("rental_agreement_branch_id_idx").on(table.branchId),
		uniqueIndex("rental_agreement_rental_id_uidx").on(table.rentalId),
	],
)

export const rentalInspection = pgTable(
	"rental_inspection",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		stage: rentalInspectionStageEnum("stage").notNull(),
		odometerKm: numeric("odometer_km", { precision: 12, scale: 2 }),
		fuelPercent: numeric("fuel_percent", { precision: 5, scale: 2 }),
		cleanliness: rentalInspectionCleanlinessEnum("cleanliness"),
		checklistJson: jsonb("checklist_json")
			.$type<Record<string, boolean>>()
			.default({})
			.notNull(),
		notes: text("notes"),
		signaturePayload: jsonb("signature_payload")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		mediaJson: jsonb("media_json")
			.$type<
				Array<{
					assetId: string
					deliveryUrl: string
					blurDataUrl: string
					label?: string | null
				}>
			>()
			.default([])
			.notNull(),
		completedByMemberId: uuid("completed_by_member_id").references(
			() => member.id,
			{ onDelete: "set null" },
		),
		completedAt: timestamp("completed_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_inspection_organization_id_idx").on(table.organizationId),
		index("rental_inspection_branch_id_idx").on(table.branchId),
		index("rental_inspection_rental_id_idx").on(table.rentalId),
		index("rental_inspection_stage_idx").on(table.stage),
	],
)

export const rentalDamage = pgTable(
	"rental_damage",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		inspectionId: uuid("inspection_id").references(() => rentalInspection.id, {
			onDelete: "set null",
		}),
		category: rentalDamageCategoryEnum("category").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		severity: rentalDamageSeverityEnum("severity").notNull(),
		customerLiabilityAmount: numeric("customer_liability_amount", {
			precision: 12,
			scale: 2,
		})
			.default("0.00")
			.notNull(),
		estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
		actualCost: numeric("actual_cost", { precision: 12, scale: 2 }),
		repairStatus: rentalDamageRepairStatusEnum("repair_status")
			.default("reported")
			.notNull(),
		mediaJson: jsonb("media_json")
			.$type<
				Array<{
					assetId: string
					deliveryUrl: string
					blurDataUrl: string
					label?: string | null
				}>
			>()
			.default([])
			.notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true }),
		repairedAt: timestamp("repaired_at", { withTimezone: true }),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_damage_organization_id_idx").on(table.organizationId),
		index("rental_damage_branch_id_idx").on(table.branchId),
		index("rental_damage_rental_id_idx").on(table.rentalId),
		index("rental_damage_inspection_id_idx").on(table.inspectionId),
		index("rental_damage_repair_status_idx").on(table.repairStatus),
	],
)

export const rentalCharge = pgTable(
	"rental_charge",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		linkedDamageId: uuid("linked_damage_id").references(() => rentalDamage.id, {
			onDelete: "set null",
		}),
		linkedPaymentId: uuid("linked_payment_id").references(
			() => rentalPayment.id,
			{
				onDelete: "set null",
			},
		),
		kind: rentalChargeKindEnum("kind").notNull(),
		status: rentalChargeStatusEnum("status").default("open").notNull(),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
			.default("0.00")
			.notNull(),
		total: numeric("total", { precision: 12, scale: 2 }).notNull(),
		currency: text("currency").default("AUD").notNull(),
		dueAt: timestamp("due_at", { withTimezone: true }),
		description: text("description"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_charge_organization_id_idx").on(table.organizationId),
		index("rental_charge_branch_id_idx").on(table.branchId),
		index("rental_charge_rental_id_idx").on(table.rentalId),
		index("rental_charge_status_idx").on(table.status),
		index("rental_charge_payment_id_idx").on(table.linkedPaymentId),
	],
)

export const rentalDepositEvent = pgTable(
	"rental_deposit_event",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		type: rentalDepositEventTypeEnum("type").notNull(),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		currency: text("currency").default("AUD").notNull(),
		linkedChargeId: uuid("linked_charge_id").references(() => rentalCharge.id, {
			onDelete: "set null",
		}),
		linkedPaymentId: uuid("linked_payment_id").references(
			() => rentalPayment.id,
			{
				onDelete: "set null",
			},
		),
		note: text("note"),
		createdByMemberId: uuid("created_by_member_id").references(
			() => member.id,
			{
				onDelete: "set null",
			},
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_deposit_event_organization_id_idx").on(table.organizationId),
		index("rental_deposit_event_branch_id_idx").on(table.branchId),
		index("rental_deposit_event_rental_id_idx").on(table.rentalId),
		index("rental_deposit_event_charge_id_idx").on(table.linkedChargeId),
		index("rental_deposit_event_payment_id_idx").on(table.linkedPaymentId),
	],
)

export const rentalAmendment = pgTable(
	"rental_amendment",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		type: rentalAmendmentTypeEnum("type").notNull(),
		previousPlannedStartAt: timestamp("previous_planned_start_at", {
			withTimezone: true,
		}),
		previousPlannedEndAt: timestamp("previous_planned_end_at", {
			withTimezone: true,
		}),
		nextPlannedStartAt: timestamp("next_planned_start_at", {
			withTimezone: true,
		}),
		nextPlannedEndAt: timestamp("next_planned_end_at", {
			withTimezone: true,
		}),
		deltaAmount: numeric("delta_amount", { precision: 12, scale: 2 })
			.default("0.00")
			.notNull(),
		currency: text("currency").default("AUD").notNull(),
		pricingSnapshotId: uuid("pricing_snapshot_id").references(
			() => rentalPricingSnapshot.id,
			{ onDelete: "set null" },
		),
		reason: text("reason"),
		createdByMemberId: uuid("created_by_member_id").references(
			() => member.id,
			{
				onDelete: "set null",
			},
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_amendment_organization_id_idx").on(table.organizationId),
		index("rental_amendment_branch_id_idx").on(table.branchId),
		index("rental_amendment_rental_id_idx").on(table.rentalId),
		index("rental_amendment_type_idx").on(table.type),
	],
)

export const rentalEvent = pgTable(
	"rental_event",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		rentalId: uuid("rental_id")
			.notNull()
			.references(() => rental.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		payloadJson: jsonb("payload_json")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		actorMemberId: uuid("actor_member_id").references(() => member.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("rental_event_organization_id_idx").on(table.organizationId),
		index("rental_event_branch_id_idx").on(table.branchId),
		index("rental_event_rental_id_idx").on(table.rentalId),
	],
)

export const vehicleAvailabilityBlock = pgTable(
	"vehicle_availability_block",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => vehicle.id, { onDelete: "cascade" }),
		rentalId: uuid("rental_id").references(() => rental.id, {
			onDelete: "set null",
		}),
		sourceType: vehicleAvailabilityBlockSourceEnum("source_type")
			.default("manual_hold")
			.notNull(),
		status: vehicleAvailabilityBlockStatusEnum("status")
			.default("active")
			.notNull(),
		startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		note: text("note"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdByMemberId: uuid("created_by_member_id").references(
			() => member.id,
			{
				onDelete: "set null",
			},
		),
		updatedByMemberId: uuid("updated_by_member_id").references(
			() => member.id,
			{
				onDelete: "set null",
			},
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("vehicle_availability_block_org_idx").on(table.organizationId),
		index("vehicle_availability_block_branch_idx").on(table.branchId),
		index("vehicle_availability_block_vehicle_idx").on(table.vehicleId),
		index("vehicle_availability_block_rental_idx").on(table.rentalId),
		index("vehicle_availability_block_status_idx").on(table.status),
		index("vehicle_availability_block_expires_idx").on(table.expiresAt),
	],
)

export const rentalRelations = relations(rental, ({ many, one }) => ({
	organization: one(organization, {
		fields: [rental.organizationId],
		references: [organization.id],
	}),
	branch: one(branch, {
		fields: [rental.branchId],
		references: [branch.id],
	}),
	vehicle: one(vehicle, {
		fields: [rental.vehicleId],
		references: [vehicle.id],
	}),
	customer: one(customer, {
		fields: [rental.customerId],
		references: [customer.id],
	}),
	createdBy: one(member, {
		fields: [rental.createdByMemberId],
		references: [member.id],
	}),
	updatedBy: one(member, {
		fields: [rental.updatedByMemberId],
		references: [member.id],
	}),
	invoices: many(rentalInvoice),
	pricingSnapshots: many(rentalPricingSnapshot),
	paymentSchedules: many(rentalPaymentSchedule),
	payments: many(rentalPayment),
	agreement: many(rentalAgreement),
	inspections: many(rentalInspection),
	damages: many(rentalDamage),
	charges: many(rentalCharge),
	depositEvents: many(rentalDepositEvent),
	amendments: many(rentalAmendment),
	events: many(rentalEvent),
	availabilityBlocks: many(vehicleAvailabilityBlock),
}))

export const rentalPricingSnapshotRelations = relations(
	rentalPricingSnapshot,
	({ one }) => ({
		organization: one(organization, {
			fields: [rentalPricingSnapshot.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [rentalPricingSnapshot.branchId],
			references: [branch.id],
		}),
		rental: one(rental, {
			fields: [rentalPricingSnapshot.rentalId],
			references: [rental.id],
		}),
	}),
)

export const rentalPaymentScheduleRelations = relations(
	rentalPaymentSchedule,
	({ many, one }) => ({
		organization: one(organization, {
			fields: [rentalPaymentSchedule.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [rentalPaymentSchedule.branchId],
			references: [branch.id],
		}),
		rental: one(rental, {
			fields: [rentalPaymentSchedule.rentalId],
			references: [rental.id],
		}),
		attempts: many(rentalPayment),
	}),
)

export const rentalPaymentRelations = relations(rentalPayment, ({ one }) => ({
	organization: one(organization, {
		fields: [rentalPayment.organizationId],
		references: [organization.id],
	}),
	branch: one(branch, {
		fields: [rentalPayment.branchId],
		references: [branch.id],
	}),
	rental: one(rental, {
		fields: [rentalPayment.rentalId],
		references: [rental.id],
	}),
	schedule: one(rentalPaymentSchedule, {
		fields: [rentalPayment.scheduleId],
		references: [rentalPaymentSchedule.id],
	}),
	invoice: one(rentalInvoice, {
		fields: [rentalPayment.invoiceId],
		references: [rentalInvoice.id],
	}),
}))

export const rentalInvoiceRelations = relations(
	rentalInvoice,
	({ many, one }) => ({
		organization: one(organization, {
			fields: [rentalInvoice.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [rentalInvoice.branchId],
			references: [branch.id],
		}),
		rental: one(rental, {
			fields: [rentalInvoice.rentalId],
			references: [rental.id],
		}),
		lineItems: many(rentalInvoiceLineItem),
		payments: many(rentalPayment),
	}),
)

export const rentalInvoiceLineItemRelations = relations(
	rentalInvoiceLineItem,
	({ one }) => ({
		organization: one(organization, {
			fields: [rentalInvoiceLineItem.organizationId],
			references: [organization.id],
		}),
		invoice: one(rentalInvoice, {
			fields: [rentalInvoiceLineItem.invoiceId],
			references: [rentalInvoice.id],
		}),
	}),
)

export const rentalAgreementRelations = relations(
	rentalAgreement,
	({ one }) => ({
		organization: one(organization, {
			fields: [rentalAgreement.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [rentalAgreement.branchId],
			references: [branch.id],
		}),
		rental: one(rental, {
			fields: [rentalAgreement.rentalId],
			references: [rental.id],
		}),
		signedBy: one(member, {
			fields: [rentalAgreement.signedByMemberId],
			references: [member.id],
		}),
	}),
)

export const rentalInspectionRelations = relations(
	rentalInspection,
	({ many, one }) => ({
		organization: one(organization, {
			fields: [rentalInspection.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [rentalInspection.branchId],
			references: [branch.id],
		}),
		rental: one(rental, {
			fields: [rentalInspection.rentalId],
			references: [rental.id],
		}),
		completedBy: one(member, {
			fields: [rentalInspection.completedByMemberId],
			references: [member.id],
		}),
		damages: many(rentalDamage),
	}),
)

export const rentalDamageRelations = relations(
	rentalDamage,
	({ many, one }) => ({
		organization: one(organization, {
			fields: [rentalDamage.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [rentalDamage.branchId],
			references: [branch.id],
		}),
		rental: one(rental, {
			fields: [rentalDamage.rentalId],
			references: [rental.id],
		}),
		inspection: one(rentalInspection, {
			fields: [rentalDamage.inspectionId],
			references: [rentalInspection.id],
		}),
		charges: many(rentalCharge),
	}),
)

export const rentalChargeRelations = relations(
	rentalCharge,
	({ many, one }) => ({
		organization: one(organization, {
			fields: [rentalCharge.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [rentalCharge.branchId],
			references: [branch.id],
		}),
		rental: one(rental, {
			fields: [rentalCharge.rentalId],
			references: [rental.id],
		}),
		damage: one(rentalDamage, {
			fields: [rentalCharge.linkedDamageId],
			references: [rentalDamage.id],
		}),
		payment: one(rentalPayment, {
			fields: [rentalCharge.linkedPaymentId],
			references: [rentalPayment.id],
		}),
		depositEvents: many(rentalDepositEvent),
	}),
)

export const rentalDepositEventRelations = relations(
	rentalDepositEvent,
	({ one }) => ({
		organization: one(organization, {
			fields: [rentalDepositEvent.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [rentalDepositEvent.branchId],
			references: [branch.id],
		}),
		rental: one(rental, {
			fields: [rentalDepositEvent.rentalId],
			references: [rental.id],
		}),
		charge: one(rentalCharge, {
			fields: [rentalDepositEvent.linkedChargeId],
			references: [rentalCharge.id],
		}),
		payment: one(rentalPayment, {
			fields: [rentalDepositEvent.linkedPaymentId],
			references: [rentalPayment.id],
		}),
		createdBy: one(member, {
			fields: [rentalDepositEvent.createdByMemberId],
			references: [member.id],
		}),
	}),
)

export const rentalAmendmentRelations = relations(
	rentalAmendment,
	({ one }) => ({
		organization: one(organization, {
			fields: [rentalAmendment.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [rentalAmendment.branchId],
			references: [branch.id],
		}),
		rental: one(rental, {
			fields: [rentalAmendment.rentalId],
			references: [rental.id],
		}),
		pricingSnapshot: one(rentalPricingSnapshot, {
			fields: [rentalAmendment.pricingSnapshotId],
			references: [rentalPricingSnapshot.id],
		}),
		createdBy: one(member, {
			fields: [rentalAmendment.createdByMemberId],
			references: [member.id],
		}),
	}),
)

export const rentalEventRelations = relations(rentalEvent, ({ one }) => ({
	organization: one(organization, {
		fields: [rentalEvent.organizationId],
		references: [organization.id],
	}),
	branch: one(branch, {
		fields: [rentalEvent.branchId],
		references: [branch.id],
	}),
	rental: one(rental, {
		fields: [rentalEvent.rentalId],
		references: [rental.id],
	}),
	actor: one(member, {
		fields: [rentalEvent.actorMemberId],
		references: [member.id],
	}),
}))

export const vehicleAvailabilityBlockRelations = relations(
	vehicleAvailabilityBlock,
	({ one }) => ({
		organization: one(organization, {
			fields: [vehicleAvailabilityBlock.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [vehicleAvailabilityBlock.branchId],
			references: [branch.id],
		}),
		vehicle: one(vehicle, {
			fields: [vehicleAvailabilityBlock.vehicleId],
			references: [vehicle.id],
		}),
		rental: one(rental, {
			fields: [vehicleAvailabilityBlock.rentalId],
			references: [rental.id],
		}),
		createdBy: one(member, {
			fields: [vehicleAvailabilityBlock.createdByMemberId],
			references: [member.id],
		}),
		updatedBy: one(member, {
			fields: [vehicleAvailabilityBlock.updatedByMemberId],
			references: [member.id],
		}),
	}),
)
