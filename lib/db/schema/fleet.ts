import { relations } from "drizzle-orm"
import {
	boolean,
	doublePrecision,
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
import { vehicle } from "./vehicles"

export const vehicleTrackingProviderEnum = pgEnum("vehicle_tracking_provider", [
	"traccar",
	"mock",
	"custom",
])

export const vehicleTelemetrySourceEnum = pgEnum("vehicle_telemetry_source", [
	"mock",
	"traccar",
])

export const vehicleTrackingDevice = pgTable(
	"vehicle_tracking_device",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => vehicle.id, { onDelete: "cascade" }),
		provider: vehicleTrackingProviderEnum("provider")
			.default("custom")
			.notNull(),
		externalDeviceId: text("external_device_id").notNull(),
		displayName: text("display_name"),
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("vehicle_tracking_device_org_idx").on(table.organizationId),
		index("vehicle_tracking_device_vehicle_idx").on(table.vehicleId),
		uniqueIndex("vehicle_tracking_device_provider_external_uidx").on(
			table.organizationId,
			table.provider,
			table.externalDeviceId,
		),
	],
)

export const vehicleLivePosition = pgTable(
	"vehicle_live_position",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => vehicle.id, { onDelete: "cascade" }),
		deviceId: uuid("device_id").references(() => vehicleTrackingDevice.id, {
			onDelete: "set null",
		}),
		latitude: doublePrecision("latitude").notNull(),
		longitude: doublePrecision("longitude").notNull(),
		speedKph: doublePrecision("speed_kph"),
		heading: doublePrecision("heading"),
		accuracyMeters: doublePrecision("accuracy_meters"),
		recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
		receivedAt: timestamp("received_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		source: vehicleTelemetrySourceEnum("source").default("mock").notNull(),
		attributesJson: jsonb("attributes_json")
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
		index("vehicle_live_position_org_idx").on(table.organizationId),
		index("vehicle_live_position_vehicle_idx").on(table.vehicleId),
		index("vehicle_live_position_device_idx").on(table.deviceId),
		index("vehicle_live_position_recorded_at_idx").on(table.recordedAt),
		uniqueIndex("vehicle_live_position_org_vehicle_uidx").on(
			table.organizationId,
			table.vehicleId,
		),
	],
)

export const vehiclePositionHistory = pgTable(
	"vehicle_position_history",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => vehicle.id, { onDelete: "cascade" }),
		deviceId: uuid("device_id").references(() => vehicleTrackingDevice.id, {
			onDelete: "set null",
		}),
		latitude: doublePrecision("latitude").notNull(),
		longitude: doublePrecision("longitude").notNull(),
		speedKph: doublePrecision("speed_kph"),
		heading: doublePrecision("heading"),
		accuracyMeters: doublePrecision("accuracy_meters"),
		recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
		receivedAt: timestamp("received_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		source: vehicleTelemetrySourceEnum("source").default("mock").notNull(),
		attributesJson: jsonb("attributes_json")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("vehicle_position_history_org_idx").on(table.organizationId),
		index("vehicle_position_history_vehicle_idx").on(table.vehicleId),
		index("vehicle_position_history_device_idx").on(table.deviceId),
		index("vehicle_position_history_vehicle_recorded_idx").on(
			table.organizationId,
			table.vehicleId,
			table.recordedAt,
		),
	],
)

export const vehicleTrackingDeviceRelations = relations(
	vehicleTrackingDevice,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [vehicleTrackingDevice.organizationId],
			references: [organization.id],
		}),
		vehicle: one(vehicle, {
			fields: [vehicleTrackingDevice.vehicleId],
			references: [vehicle.id],
		}),
		livePositions: many(vehicleLivePosition),
		positionHistory: many(vehiclePositionHistory),
	}),
)

export const vehicleLivePositionRelations = relations(
	vehicleLivePosition,
	({ one }) => ({
		organization: one(organization, {
			fields: [vehicleLivePosition.organizationId],
			references: [organization.id],
		}),
		vehicle: one(vehicle, {
			fields: [vehicleLivePosition.vehicleId],
			references: [vehicle.id],
		}),
		device: one(vehicleTrackingDevice, {
			fields: [vehicleLivePosition.deviceId],
			references: [vehicleTrackingDevice.id],
		}),
	}),
)

export const vehiclePositionHistoryRelations = relations(
	vehiclePositionHistory,
	({ one }) => ({
		organization: one(organization, {
			fields: [vehiclePositionHistory.organizationId],
			references: [organization.id],
		}),
		vehicle: one(vehicle, {
			fields: [vehiclePositionHistory.vehicleId],
			references: [vehicle.id],
		}),
		device: one(vehicleTrackingDevice, {
			fields: [vehiclePositionHistory.deviceId],
			references: [vehicleTrackingDevice.id],
		}),
	}),
)
