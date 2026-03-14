import { and, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import {
	normalizeCustomerEmail,
	normalizeCustomerPhone,
} from "@/features/customers/lib/normalize"
import { forbiddenError, jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { getScopedBranchIdsForViewer } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { customer } from "@/lib/db/schema/customers"

type RouteProps = {
	params: Promise<{
		customerId: string
	}>
}

export async function PATCH(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "manageCustomers" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const { customerId } = await params
	const organizationId = viewer.activeOrganizationId
	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)

	const customerRows = await db
		.select({
			id: customer.id,
			branchId: customer.branchId,
		})
		.from(customer)
		.where(
			and(
				eq(customer.id, customerId),
				eq(customer.organizationId, organizationId),
			),
		)
		.limit(1)

	const targetCustomer = customerRows[0]
	if (!targetCustomer) {
		return jsonError("Customer not found.", 404)
	}

	if (scopedBranchIds !== null) {
		if (
			!targetCustomer.branchId ||
			!scopedBranchIds.includes(targetCustomer.branchId)
		) {
			return forbiddenError()
		}
	}

	const payload = (await request.json()) as {
		fullName?: string
		email?: string | null
		phone?: string | null
		branchId?: string | null
		verificationStatus?: string
		verificationMetadata?: Record<string, unknown>
	}

	const updates: Partial<typeof customer.$inferInsert> = {
		updatedAt: new Date(),
	}

	if (typeof payload.fullName === "string") {
		updates.fullName = payload.fullName.trim()
	}

	if (payload.email !== undefined) {
		updates.email = payload.email?.trim() || null
		updates.emailNormalized = normalizeCustomerEmail(payload.email)
	}

	if (payload.phone !== undefined) {
		updates.phone = payload.phone?.trim() || null
		updates.phoneNormalized = normalizeCustomerPhone(payload.phone)
	}

	if (payload.branchId !== undefined) {
		const nextBranchId = payload.branchId?.trim() || null

		if (nextBranchId) {
			const validBranchRows = await db
				.select({ id: branch.id })
				.from(branch)
				.where(
					scopedBranchIds === null
						? and(
								eq(branch.organizationId, organizationId),
								eq(branch.id, nextBranchId),
							)
						: and(
								eq(branch.organizationId, organizationId),
								eq(branch.id, nextBranchId),
								inArray(branch.id, scopedBranchIds),
							),
				)
				.limit(1)

			if (!validBranchRows[0]) {
				return jsonError("Invalid branch assignment.", 400)
			}
		}

		updates.branchId = nextBranchId
	}

	if (typeof payload.verificationStatus === "string") {
		updates.verificationStatus = payload.verificationStatus.trim()
	}

	if (
		payload.verificationMetadata &&
		typeof payload.verificationMetadata === "object"
	) {
		updates.verificationMetadata = payload.verificationMetadata
	}

	await db
		.update(customer)
		.set(updates)
		.where(
			and(
				eq(customer.id, customerId),
				eq(customer.organizationId, organizationId),
			),
		)

	return NextResponse.json({ success: true })
}
