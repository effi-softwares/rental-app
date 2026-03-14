import { relations } from "drizzle-orm"
import {
	boolean,
	date,
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

import { organization } from "./auth"
import { branch } from "./branches"

export const transmissionEnum = pgEnum("transmission", [
	"Automatic",
	"Manual",
	"Semi-Automatic",
])

export const fuelTypeEnum = pgEnum("fuel_type", [
	"Petrol",
	"Diesel",
	"Electric",
	"Hybrid",
	"Hydrogen",
])

export const drivetrainEnum = pgEnum("drivetrain", [
	"FWD",
	"RWD",
	"AWD",
	"4WD",
	"Electric-Single",
	"Electric-Dual",
])

export const vehicleStatusEnum = pgEnum("vehicle_status", [
	"Available",
	"Rented",
	"Maintenance",
	"Retired",
])

export const pricingModelEnum = pgEnum("pricing_model", [
	"Daily",
	"Weekly",
	"Monthly",
	"Distance-Based",
])

export const mileageTypeEnum = pgEnum("mileage_type", ["Unlimited", "Limited"])
export const distanceUnitEnum = pgEnum("distance_unit", ["km", "miles"])

export const vehicleType = pgTable(
	"vehicle_type",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [uniqueIndex("vehicle_type_name_uidx").on(table.name)],
)

export const vehicleClass = pgTable(
	"vehicle_class",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		code: text("code").notNull(),
		description: text("description"),
		bodyTypeId: uuid("body_type_id").references(() => vehicleType.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("vehicle_class_organization_id_idx").on(table.organizationId),
		uniqueIndex("vehicle_class_org_code_uidx").on(
			table.organizationId,
			table.code,
		),
		uniqueIndex("vehicle_class_org_name_uidx").on(
			table.organizationId,
			table.name,
		),
	],
)

export const vehicleBrand = pgTable(
	"vehicle_brand",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name").notNull(),
		country: text("country"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [uniqueIndex("vehicle_brand_name_uidx").on(table.name)],
)

export const vehicleModel = pgTable(
	"vehicle_model",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		brandId: uuid("brand_id")
			.notNull()
			.references(() => vehicleBrand.id, { onDelete: "cascade" }),
		bodyTypeId: uuid("body_type_id").references(() => vehicleType.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("vehicle_model_brand_id_idx").on(table.brandId),
		uniqueIndex("vehicle_model_brand_name_uidx").on(table.brandId, table.name),
	],
)

export const vehicle = pgTable(
	"vehicle",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		brandId: uuid("brand_id")
			.notNull()
			.references(() => vehicleBrand.id, { onDelete: "restrict" }),
		modelId: uuid("model_id")
			.notNull()
			.references(() => vehicleModel.id, { onDelete: "restrict" }),
		vehicleClassId: uuid("vehicle_class_id").references(() => vehicleClass.id, {
			onDelete: "set null",
		}),
		bodyTypeId: uuid("body_type_id").references(() => vehicleType.id, {
			onDelete: "set null",
		}),
		year: integer("year").notNull(),
		vin: text("vin").notNull(),
		licensePlate: text("license_plate").notNull(),
		color: jsonb("color")
			.$type<{ name: string; label: string; hex: string }>()
			.notNull(),
		isBrandNew: boolean("is_brand_new").default(false).notNull(),
		transmission: transmissionEnum("transmission").notNull(),
		fuelType: fuelTypeEnum("fuel_type").notNull(),
		drivetrain: drivetrainEnum("drivetrain").notNull(),
		seats: integer("seats").notNull(),
		doors: integer("doors").notNull(),
		baggageCapacity: integer("baggage_capacity").notNull(),
		hasAc: boolean("has_ac").default(false).notNull(),
		hasNavigation: boolean("has_navigation").default(false).notNull(),
		hasBluetooth: boolean("has_bluetooth").default(false).notNull(),
		isPetFriendly: boolean("is_pet_friendly").default(false).notNull(),
		status: vehicleStatusEnum("status").default("Available").notNull(),
		registrationExpiryDate: date("registration_expiry_date", {
			mode: "date",
		}).notNull(),
		insuranceExpiryDate: date("insurance_expiry_date", {
			mode: "date",
		}).notNull(),
		insurancePolicyNumber: text("insurance_policy_number").notNull(),
		images: jsonb("images")
			.$type<{
				frontImages?: Array<{
					assetId: string
					url: string
					deliveryUrl: string
					blurDataUrl: string
					sortOrder: number
				}>
				backImages?: Array<{
					assetId: string
					url: string
					deliveryUrl: string
					blurDataUrl: string
					sortOrder: number
				}>
				interiorImages?: Array<{
					assetId: string
					url: string
					deliveryUrl: string
					blurDataUrl: string
					sortOrder: number
				}>
			}>()
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
		index("vehicle_organization_id_idx").on(table.organizationId),
		index("vehicle_branch_id_idx").on(table.branchId),
		index("vehicle_status_idx").on(table.status),
		uniqueIndex("vehicle_organization_vin_uidx").on(
			table.organizationId,
			table.vin,
		),
		uniqueIndex("vehicle_organization_license_uidx").on(
			table.organizationId,
			table.licensePlate,
		),
	],
)

export const vehicleRate = pgTable(
	"vehicle_rate",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => vehicle.id, { onDelete: "cascade" }),
		pricingModel: pricingModelEnum("pricing_model").notNull(),
		rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
		mileageType: mileageTypeEnum("mileage_type").notNull(),
		limitPerDay: integer("limit_per_day"),
		overageFeePerUnit: numeric("overage_fee_per_unit", {
			precision: 12,
			scale: 2,
		}),
		measureUnit: distanceUnitEnum("measure_unit").default("km"),
		requiresDeposit: boolean("requires_deposit").default(false).notNull(),
		depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("vehicle_rate_organization_id_idx").on(table.organizationId),
		index("vehicle_rate_vehicle_id_idx").on(table.vehicleId),
		uniqueIndex("vehicle_rate_vehicle_pricing_model_uidx").on(
			table.vehicleId,
			table.pricingModel,
		),
	],
)

export const vehicleTypeRelations = relations(vehicleType, ({ many }) => ({
	models: many(vehicleModel),
	vehicles: many(vehicle),
	vehicleClasses: many(vehicleClass),
}))

export const vehicleClassRelations = relations(
	vehicleClass,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [vehicleClass.organizationId],
			references: [organization.id],
		}),
		bodyType: one(vehicleType, {
			fields: [vehicleClass.bodyTypeId],
			references: [vehicleType.id],
		}),
		vehicles: many(vehicle),
	}),
)

export const vehicleBrandRelations = relations(vehicleBrand, ({ many }) => ({
	models: many(vehicleModel),
	vehicles: many(vehicle),
}))

export const vehicleModelRelations = relations(
	vehicleModel,
	({ one, many }) => ({
		brand: one(vehicleBrand, {
			fields: [vehicleModel.brandId],
			references: [vehicleBrand.id],
		}),
		bodyType: one(vehicleType, {
			fields: [vehicleModel.bodyTypeId],
			references: [vehicleType.id],
		}),
		vehicles: many(vehicle),
	}),
)

export const vehicleRelations = relations(vehicle, ({ one, many }) => ({
	organization: one(organization, {
		fields: [vehicle.organizationId],
		references: [organization.id],
	}),
	branch: one(branch, {
		fields: [vehicle.branchId],
		references: [branch.id],
	}),
	brand: one(vehicleBrand, {
		fields: [vehicle.brandId],
		references: [vehicleBrand.id],
	}),
	model: one(vehicleModel, {
		fields: [vehicle.modelId],
		references: [vehicleModel.id],
	}),
	vehicleClass: one(vehicleClass, {
		fields: [vehicle.vehicleClassId],
		references: [vehicleClass.id],
	}),
	bodyType: one(vehicleType, {
		fields: [vehicle.bodyTypeId],
		references: [vehicleType.id],
	}),
	rates: many(vehicleRate),
}))

export const vehicleRateRelations = relations(vehicleRate, ({ one }) => ({
	organization: one(organization, {
		fields: [vehicleRate.organizationId],
		references: [organization.id],
	}),
	vehicle: one(vehicle, {
		fields: [vehicleRate.vehicleId],
		references: [vehicle.id],
	}),
}))
