import {
	bigserial,
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"

import { organization } from "./auth"
import { branch } from "./branches"

export const stripeWebhookEventStatusEnum = pgEnum(
	"stripe_webhook_event_status",
	["received", "processed", "ignored", "failed"],
)

export const workspaceRealtimeTopicEnum = pgEnum("workspace_realtime_topic", [
	"billing_attention",
	"rentals",
])

export const workspaceRealtimeAttentionEnum = pgEnum(
	"workspace_realtime_attention",
	["none", "info", "warning", "critical"],
)

export const stripeWebhookEvent = pgTable(
	"stripe_webhook_event",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id").references(() => organization.id, {
			onDelete: "cascade",
		}),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		stripeEventId: text("stripe_event_id").notNull(),
		type: text("type").notNull(),
		mode: text("mode").notNull(),
		apiVersion: text("api_version"),
		accountId: text("account_id"),
		objectType: text("object_type"),
		objectId: text("object_id"),
		status: stripeWebhookEventStatusEnum("status")
			.default("received")
			.notNull(),
		errorMessage: text("error_message"),
		payloadJson: jsonb("payload_json")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		receivedAt: timestamp("received_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		processedAt: timestamp("processed_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("stripe_webhook_event_stripe_event_id_uidx").on(
			table.stripeEventId,
		),
		index("stripe_webhook_event_organization_id_idx").on(table.organizationId),
		index("stripe_webhook_event_branch_id_idx").on(table.branchId),
		index("stripe_webhook_event_status_idx").on(table.status),
		index("stripe_webhook_event_type_idx").on(table.type),
		index("stripe_webhook_event_object_id_idx").on(table.objectId),
		index("stripe_webhook_event_org_received_at_idx").on(
			table.organizationId,
			table.receivedAt,
		),
		index("stripe_webhook_event_org_status_received_at_idx").on(
			table.organizationId,
			table.status,
			table.receivedAt,
		),
	],
)

export const workspaceRealtimeEvent = pgTable(
	"workspace_realtime_event",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		topic: workspaceRealtimeTopicEnum("topic").notNull(),
		eventType: text("event_type").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		attention: workspaceRealtimeAttentionEnum("attention")
			.default("none")
			.notNull(),
		summary: text("summary"),
		payloadJson: jsonb("payload_json")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("workspace_realtime_event_organization_id_idx").on(
			table.organizationId,
		),
		index("workspace_realtime_event_branch_id_idx").on(table.branchId),
		index("workspace_realtime_event_topic_idx").on(table.topic),
		index("workspace_realtime_event_organization_topic_id_idx").on(
			table.organizationId,
			table.topic,
			table.id,
		),
	],
)
