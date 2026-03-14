import { relations } from "drizzle-orm"
import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"

import { member, organization } from "./auth"

export const branch = pgTable(
	"branch",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		code: text("code").notNull(),
		address: text("address"),
		stripeTerminalLocationId: text("stripe_terminal_location_id"),
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("branch_organization_id_idx").on(table.organizationId),
		index("branch_stripe_terminal_location_id_idx").on(
			table.stripeTerminalLocationId,
		),
		uniqueIndex("branch_organization_code_uidx").on(
			table.organizationId,
			table.code,
		),
	],
)

export const memberBranchAccess = pgTable(
	"member_branch_access",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id")
			.notNull()
			.references(() => branch.id, { onDelete: "cascade" }),
		memberId: uuid("member_id")
			.notNull()
			.references(() => member.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("member_branch_access_organization_id_idx").on(table.organizationId),
		index("member_branch_access_branch_id_idx").on(table.branchId),
		index("member_branch_access_member_id_idx").on(table.memberId),
		uniqueIndex("member_branch_access_unique_member_branch").on(
			table.memberId,
			table.branchId,
		),
	],
)

export const branchRelations = relations(branch, ({ one, many }) => ({
	organization: one(organization, {
		fields: [branch.organizationId],
		references: [organization.id],
	}),
	accessList: many(memberBranchAccess),
}))

export const memberBranchAccessRelations = relations(
	memberBranchAccess,
	({ one }) => ({
		organization: one(organization, {
			fields: [memberBranchAccess.organizationId],
			references: [organization.id],
		}),
		branch: one(branch, {
			fields: [memberBranchAccess.branchId],
			references: [branch.id],
		}),
		member: one(member, {
			fields: [memberBranchAccess.memberId],
			references: [member.id],
		}),
	}),
)
