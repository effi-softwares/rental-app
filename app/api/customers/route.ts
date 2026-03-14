import { and, asc, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import {
	normalizeCustomerEmail,
	normalizeCustomerPhone,
} from "@/features/customers/lib/normalize"
import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import {
	getScopedBranchIdsForViewer,
	viewerHasPermission,
} from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { customer } from "@/lib/db/schema/customers"

type CustomerResponse = {
	id: string
	fullName: string
	email: string | null
	phone: string | null
	branchId: string | null
	branchName: string | null
	verificationStatus: string
	verificationMetadata: Record<string, unknown>
	createdAt: string
}

type BranchResponse = {
	id: string
	name: string
	code: string
}

function normalizeCustomerRecord(row: {
	id: string
	fullName: string
	email: string | null
	phone: string | null
	branchId: string | null
	branchName: string | null
	verificationStatus: string
	verificationMetadata: Record<string, unknown> | null
	createdAt: Date
}): CustomerResponse {
	return {
		id: row.id,
		fullName: row.fullName,
		email: row.email,
		phone: row.phone,
		branchId: row.branchId,
		branchName: row.branchName,
		verificationStatus: row.verificationStatus,
		verificationMetadata: (row.verificationMetadata ?? {}) as Record<
			string,
			unknown
		>,
		createdAt: row.createdAt.toISOString(),
	}
}

export async function GET() {
	const guard = await requireViewer({ permission: "viewCustomerModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const organizationId = viewer.activeOrganizationId
	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)
	const [canManageCustomers, canManageCustomerNotes] = await Promise.all([
		viewerHasPermission(viewer, "manageCustomers"),
		viewerHasPermission(viewer, "manageCustomerNotes"),
	])

	if (scopedBranchIds !== null && scopedBranchIds.length === 0) {
		return NextResponse.json({
			customers: [],
			branches: [],
			canManageCustomers,
			canManageCustomerNotes,
		})
	}

	const branchWhere =
		scopedBranchIds === null
			? eq(branch.organizationId, organizationId)
			: and(
					eq(branch.organizationId, organizationId),
					inArray(branch.id, scopedBranchIds),
				)

	const branches = await db
		.select({ id: branch.id, name: branch.name, code: branch.code })
		.from(branch)
		.where(branchWhere)

	const customerRows = await db
		.select({
			id: customer.id,
			organizationId: customer.organizationId,
			branchId: customer.branchId,
			fullName: customer.fullName,
			email: customer.email,
			phone: customer.phone,
			verificationStatus: customer.verificationStatus,
			verificationMetadata: customer.verificationMetadata,
			createdAt: customer.createdAt,
			updatedAt: customer.updatedAt,
			branchName: branch.name,
		})
		.from(customer)
		.leftJoin(branch, eq(customer.branchId, branch.id))
		.where(
			scopedBranchIds === null
				? eq(customer.organizationId, organizationId)
				: and(
						eq(customer.organizationId, organizationId),
						inArray(customer.branchId, scopedBranchIds),
					),
		)
		.orderBy(asc(customer.fullName))

	return NextResponse.json({
		customers: customerRows.map(normalizeCustomerRecord),
		branches: branches as BranchResponse[],
		canManageCustomers,
		canManageCustomerNotes,
	})
}

export async function POST(request: Request) {
	const guard = await requireViewer({ permission: "manageCustomers" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const payload = (await request.json()) as {
		fullName?: string
		email?: string
		phone?: string
		branchId?: string
		verificationStatus?: string
		verificationMetadata?: Record<string, unknown>
	}

	const fullName = payload.fullName?.trim()
	const organizationId = viewer.activeOrganizationId
	const branchId = payload.branchId?.trim() || null

	if (!fullName) {
		return jsonError("Customer full name is required.", 400)
	}

	if (branchId) {
		const branchRecord = await db
			.select({ id: branch.id })
			.from(branch)
			.where(
				and(eq(branch.organizationId, organizationId), eq(branch.id, branchId)),
			)
			.limit(1)

		if (!branchRecord[0]) {
			return jsonError("Selected branch was not found.", 404)
		}
	}

	const created = await db
		.insert(customer)
		.values({
			organizationId,
			branchId,
			fullName,
			email: payload.email?.trim() || null,
			emailNormalized: normalizeCustomerEmail(payload.email),
			phone: payload.phone?.trim() || null,
			phoneNormalized: normalizeCustomerPhone(payload.phone),
			verificationStatus: payload.verificationStatus?.trim() || "pending",
			verificationMetadata: payload.verificationMetadata ?? {},
		})
		.returning({ id: customer.id })

	return NextResponse.json({ id: created[0].id }, { status: 201 })
}
