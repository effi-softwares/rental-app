import { relations } from "drizzle-orm"
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core"

import { member, organization } from "./auth"
import { branch } from "./branches"

export const customer = pgTable(
	"customer",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		branchId: uuid("branch_id").references(() => branch.id, {
			onDelete: "set null",
		}),
		fullName: text("full_name").notNull(),
		email: text("email"),
		emailNormalized: text("email_normalized"),
		phone: text("phone"),
		phoneNormalized: text("phone_normalized"),
		stripeCustomerId: text("stripe_customer_id"),
		verificationStatus: text("verification_status")
			.default("pending")
			.notNull(),
		verificationMetadata: jsonb("verification_metadata")
			.$type<Record<string, unknown>>()
			.default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("customer_organization_id_idx").on(table.organizationId),
		index("customer_branch_id_idx").on(table.branchId),
		index("customer_email_normalized_idx").on(table.emailNormalized),
		index("customer_phone_normalized_idx").on(table.phoneNormalized),
		index("customer_stripe_customer_id_idx").on(table.stripeCustomerId),
		index("customer_verification_status_idx").on(table.verificationStatus),
	],
)

export const customerNote = pgTable(
	"customer_note",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		customerId: uuid("customer_id")
			.notNull()
			.references(() => customer.id, { onDelete: "cascade" }),
		authorMemberId: uuid("author_member_id")
			.notNull()
			.references(() => member.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("customer_note_organization_id_idx").on(table.organizationId),
		index("customer_note_customer_id_idx").on(table.customerId),
		index("customer_note_author_member_id_idx").on(table.authorMemberId),
	],
)

export const customerRelations = relations(customer, ({ one, many }) => ({
	organization: one(organization, {
		fields: [customer.organizationId],
		references: [organization.id],
	}),
	branch: one(branch, {
		fields: [customer.branchId],
		references: [branch.id],
	}),
	notes: many(customerNote),
}))

export const customerNoteRelations = relations(customerNote, ({ one }) => ({
	organization: one(organization, {
		fields: [customerNote.organizationId],
		references: [organization.id],
	}),
	customer: one(customer, {
		fields: [customerNote.customerId],
		references: [customer.id],
	}),
	author: one(member, {
		fields: [customerNote.authorMemberId],
		references: [member.id],
	}),
}))
