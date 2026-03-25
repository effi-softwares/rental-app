import { and, eq, inArray, type SQL, sql } from "drizzle-orm"

import {
	CUSTOMER_STATUSES,
	CUSTOMER_VERIFICATION_STATUSES,
} from "@/features/customers/constants"
import type {
	CustomerDetail,
	CustomerListRow,
} from "@/features/customers/types"
import { forbiddenError, jsonError } from "@/lib/api/errors"
import { getScopedBranchIdsForViewer } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { customer } from "@/lib/db/schema/customers"
import type { Context } from "@/types"

export const CUSTOMER_PAGE_SIZE = 25

export function parsePageParam(
	value: string | null | undefined,
	fallback: number,
) {
	const parsed = Number(value)
	if (!Number.isFinite(parsed) || parsed < 1) {
		return fallback
	}

	return Math.floor(parsed)
}

export function parsePageSizeParam(
	value: string | null | undefined,
	fallback: number,
) {
	const parsed = Number(value)
	if (!Number.isFinite(parsed) || parsed < 1) {
		return fallback
	}

	return Math.min(100, Math.floor(parsed))
}

export function parseCustomerStatusFilter(value: string | null | undefined) {
	if (value === "all") {
		return "all" as const
	}

	if (CUSTOMER_STATUSES.includes(value as (typeof CUSTOMER_STATUSES)[number])) {
		return value as (typeof CUSTOMER_STATUSES)[number]
	}

	return "all" as const
}

export function parseCustomerVerificationFilter(
	value: string | null | undefined,
) {
	if (
		CUSTOMER_VERIFICATION_STATUSES.includes(
			value as (typeof CUSTOMER_VERIFICATION_STATUSES)[number],
		)
	) {
		return value as (typeof CUSTOMER_VERIFICATION_STATUSES)[number]
	}

	return "" as const
}

export function buildBranchScopedPredicate(
	column: typeof customer.branchId | typeof branch.id,
	branchIds: string[] | null,
) {
	if (branchIds === null) {
		return undefined as SQL | undefined
	}

	if (branchIds.length === 0) {
		return sql`false`
	}

	return inArray(column, branchIds)
}

export function normalizeCustomerListRow(row: {
	id: string
	fullName: string
	email: string | null
	phone: string | null
	branchId: string | null
	branchName: string | null
	verificationStatus: string
	status: string
	bannedAt: Date | null
	createdAt: Date
	updatedAt: Date
}): CustomerListRow {
	return {
		id: row.id,
		fullName: row.fullName,
		email: row.email,
		phone: row.phone,
		branchId: row.branchId,
		branchName: row.branchName,
		verificationStatus:
			row.verificationStatus as CustomerListRow["verificationStatus"],
		status: row.status as CustomerListRow["status"],
		bannedAt: row.bannedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}
}

export function normalizeCustomerDetail(row: {
	id: string
	fullName: string
	email: string | null
	phone: string | null
	branchId: string | null
	branchName: string | null
	verificationStatus: string
	verificationMetadata: Record<string, unknown> | null
	status: string
	bannedAt: Date | null
	createdAt: Date
	updatedAt: Date
}): CustomerDetail {
	return {
		id: row.id,
		fullName: row.fullName,
		email: row.email,
		phone: row.phone,
		branchId: row.branchId,
		branchName: row.branchName,
		verificationStatus:
			row.verificationStatus as CustomerDetail["verificationStatus"],
		verificationMetadata: row.verificationMetadata ?? {},
		status: row.status as CustomerDetail["status"],
		bannedAt: row.bannedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}
}

export async function resolveScopedBranchIds(viewer: Context) {
	return getScopedBranchIdsForViewer(viewer)
}

export async function resolveAssignableBranch(input: {
	viewer: Context & { activeOrganizationId: string }
	branchId: string | null
}) {
	const { branchId, viewer } = input

	if (!branchId) {
		return { branch: null }
	}

	const scopedBranchIds = await resolveScopedBranchIds(viewer)
	const rows = await db
		.select({ id: branch.id, name: branch.name, code: branch.code })
		.from(branch)
		.where(
			and(
				eq(branch.organizationId, viewer.activeOrganizationId),
				eq(branch.id, branchId),
				buildBranchScopedPredicate(branch.id, scopedBranchIds),
			),
		)
		.limit(1)

	const branchRecord = rows[0] ?? null
	if (!branchRecord) {
		return {
			error: jsonError(
				"Selected branch was not found or is outside your scope.",
				404,
			),
		}
	}

	return { branch: branchRecord }
}

export async function resolveVisibleCustomer(input: {
	viewer: Context & { activeOrganizationId: string }
	customerId: string
}) {
	const { customerId, viewer } = input
	const scopedBranchIds = await resolveScopedBranchIds(viewer)
	const rows = await db
		.select({
			id: customer.id,
			branchId: customer.branchId,
			branchName: branch.name,
			fullName: customer.fullName,
			email: customer.email,
			phone: customer.phone,
			verificationStatus: customer.verificationStatus,
			verificationMetadata: customer.verificationMetadata,
			status: customer.status,
			bannedAt: customer.bannedAt,
			createdAt: customer.createdAt,
			updatedAt: customer.updatedAt,
		})
		.from(customer)
		.leftJoin(branch, eq(customer.branchId, branch.id))
		.where(
			and(
				eq(customer.organizationId, viewer.activeOrganizationId),
				eq(customer.id, customerId),
			),
		)
		.limit(1)

	const record = rows[0] ?? null
	if (!record) {
		return {
			customer: null,
			scopedBranchIds,
			response: jsonError("Customer not found.", 404),
		}
	}

	if (
		scopedBranchIds !== null &&
		(!record.branchId || !scopedBranchIds.includes(record.branchId))
	) {
		return {
			customer: null,
			scopedBranchIds,
			response: forbiddenError(),
		}
	}

	return { customer: record, scopedBranchIds, response: null }
}
