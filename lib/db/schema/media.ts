import { relations } from "drizzle-orm"
import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth"
import { branch } from "./branches"

export const mediaAsset = pgTable(
	"media_asset",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		createdByUserId: uuid("created_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		provider: text("provider").notNull(),
		visibility: text("visibility").notNull(),
		status: text("status").notNull().default("pending"),
		pathname: text("pathname").notNull(),
		url: text("url").notNull(),
		downloadUrl: text("download_url"),
		originalFileName: text("original_file_name"),
		contentType: text("content_type"),
		sizeBytes: integer("size_bytes"),
		etag: text("etag"),
		width: integer("width"),
		height: integer("height"),
		blurDataUrl: text("blur_data_url"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("media_asset_organization_id_idx").on(table.organizationId),
		index("media_asset_branch_id_idx").on(table.branchId),
		index("media_asset_status_idx").on(table.status),
		index("media_asset_created_by_user_id_idx").on(table.createdByUserId),
		uniqueIndex("media_asset_org_pathname_uidx").on(
			table.organizationId,
			table.pathname,
		),
	],
)

export const mediaLink = pgTable(
	"media_link",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		assetId: uuid("asset_id")
			.notNull()
			.references(() => mediaAsset.id, { onDelete: "cascade" }),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		field: text("field").notNull().default("default"),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("media_link_organization_id_idx").on(table.organizationId),
		index("media_link_asset_id_idx").on(table.assetId),
		index("media_link_org_entity_field_sort_idx").on(
			table.organizationId,
			table.entityType,
			table.entityId,
			table.field,
			table.sortOrder,
		),
		index("media_link_entity_lookup_idx").on(
			table.organizationId,
			table.entityType,
			table.entityId,
		),
		uniqueIndex("media_link_unique_binding_uidx").on(
			table.organizationId,
			table.assetId,
			table.entityType,
			table.entityId,
			table.field,
		),
	],
)

export const mediaAssetRelations = relations(mediaAsset, ({ one, many }) => ({
	organization: one(organization, {
		fields: [mediaAsset.organizationId],
		references: [organization.id],
	}),
	branch: one(branch, {
		fields: [mediaAsset.branchId],
		references: [branch.id],
	}),
	createdByUser: one(user, {
		fields: [mediaAsset.createdByUserId],
		references: [user.id],
	}),
	links: many(mediaLink),
}))

export const mediaLinkRelations = relations(mediaLink, ({ one }) => ({
	organization: one(organization, {
		fields: [mediaLink.organizationId],
		references: [organization.id],
	}),
	asset: one(mediaAsset, {
		fields: [mediaLink.assetId],
		references: [mediaAsset.id],
	}),
}))
