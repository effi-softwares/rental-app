import { and, count, eq, inArray, type SQL, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import {
	getScopedBranchIdsForViewer,
	viewerHasPermission,
} from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { rental, rentalPayment } from "@/lib/db/schema/rentals"

function buildBranchScopedPredicate(
	column: typeof rental.branchId | typeof rentalPayment.branchId,
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

export async function GET() {
	const guard = await requireViewer()

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	if (!viewer.activeOrganizationId) {
		return new Response(null, { status: 401 })
	}

	const [canManageBillingAttention, canViewBookings] = await Promise.all([
		viewerHasPermission(viewer, "manageBillingAttentionModule"),
		viewerHasPermission(viewer, "viewBookingsModule"),
	])

	if (!canManageBillingAttention && !canViewBookings) {
		return new Response(null, { status: 403 })
	}

	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)
	const rentalBranchScope = buildBranchScopedPredicate(
		rental.branchId,
		scopedBranchIds,
	)
	const paymentBranchScope = buildBranchScopedPredicate(
		rentalPayment.branchId,
		scopedBranchIds,
	)

	const [rentalsAwaitingPaymentRows, requiresActionRows, failedRows, becsRows] =
		await Promise.all([
			db
				.select({ value: count() })
				.from(rental)
				.where(
					and(
						eq(rental.organizationId, viewer.activeOrganizationId),
						eq(rental.status, "awaiting_payment"),
						rentalBranchScope,
					),
				),
			db
				.select({ value: count() })
				.from(rentalPayment)
				.where(
					and(
						eq(rentalPayment.organizationId, viewer.activeOrganizationId),
						eq(rentalPayment.status, "requires_action"),
						paymentBranchScope,
					),
				),
			db
				.select({ value: count() })
				.from(rentalPayment)
				.where(
					and(
						eq(rentalPayment.organizationId, viewer.activeOrganizationId),
						eq(rentalPayment.status, "failed"),
						paymentBranchScope,
					),
				),
			db
				.select({ value: count() })
				.from(rentalPayment)
				.where(
					and(
						eq(rentalPayment.organizationId, viewer.activeOrganizationId),
						eq(rentalPayment.status, "pending"),
						eq(rentalPayment.paymentMethodType, "au_becs_debit"),
						paymentBranchScope,
					),
				),
		])

	const rentalsAwaitingPaymentCount = Number(
		rentalsAwaitingPaymentRows[0]?.value ?? 0,
	)
	const requiresActionPaymentsCount = canManageBillingAttention
		? Number(requiresActionRows[0]?.value ?? 0)
		: 0
	const failedPaymentsCount = canManageBillingAttention
		? Number(failedRows[0]?.value ?? 0)
		: 0
	const pendingDirectDebitCount = canManageBillingAttention
		? Number(becsRows[0]?.value ?? 0)
		: 0

	return NextResponse.json({
		openAttentionCount:
			rentalsAwaitingPaymentCount +
			requiresActionPaymentsCount +
			failedPaymentsCount +
			pendingDirectDebitCount,
		rentalsAwaitingPaymentCount,
		requiresActionPaymentsCount,
		failedPaymentsCount,
		pendingDirectDebitCount,
	})
}
