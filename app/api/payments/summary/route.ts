import { and, count, eq, inArray, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { rental, rentalPayment } from "@/lib/db/schema/rentals"
import { stripeWebhookEvent } from "@/lib/db/schema/workspace"
import { buildBranchScopedPredicate, getScopedPaymentAccess } from "../_lib"

export async function GET() {
	const guard = await requireViewer({ permission: "managePaymentsModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const { scopedBranchIds, paymentBranchScope, webhookBranchScope } =
		await getScopedPaymentAccess(viewer)
	const rentalBranchScope = buildBranchScopedPredicate(
		rental.branchId,
		scopedBranchIds,
	)

	const [
		collectedRows,
		collectedCountRows,
		pendingRows,
		requiresActionRows,
		failedRows,
		pendingDirectDebitRows,
		recurringPastDueRows,
		failedWebhookRows,
	] = await Promise.all([
		db
			.select({
				value: sql<string>`coalesce(sum(${rentalPayment.amount}), 0)`,
			})
			.from(rentalPayment)
			.where(
				and(
					eq(rentalPayment.organizationId, viewer.activeOrganizationId),
					eq(rentalPayment.status, "succeeded"),
					paymentBranchScope,
				),
			),
		db
			.select({ value: count() })
			.from(rentalPayment)
			.where(
				and(
					eq(rentalPayment.organizationId, viewer.activeOrganizationId),
					eq(rentalPayment.status, "succeeded"),
					paymentBranchScope,
				),
			),
		db
			.select({ value: count() })
			.from(rentalPayment)
			.where(
				and(
					eq(rentalPayment.organizationId, viewer.activeOrganizationId),
					inArray(rentalPayment.status, ["pending", "processing"]),
					paymentBranchScope,
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
					inArray(rentalPayment.status, ["failed", "cancelled", "refunded"]),
					paymentBranchScope,
				),
			),
		db
			.select({ value: count() })
			.from(rentalPayment)
			.where(
				and(
					eq(rentalPayment.organizationId, viewer.activeOrganizationId),
					eq(rentalPayment.paymentMethodType, "au_becs_debit"),
					inArray(rentalPayment.status, [
						"pending",
						"processing",
						"requires_action",
					]),
					paymentBranchScope,
				),
			),
		db
			.select({ value: count() })
			.from(rental)
			.where(
				and(
					eq(rental.organizationId, viewer.activeOrganizationId),
					eq(rental.recurringBillingState, "past_due"),
					rentalBranchScope,
				),
			),
		db
			.select({ value: count() })
			.from(stripeWebhookEvent)
			.where(
				and(
					eq(stripeWebhookEvent.organizationId, viewer.activeOrganizationId),
					eq(stripeWebhookEvent.status, "failed"),
					webhookBranchScope,
				),
			),
	])

	return NextResponse.json({
		summary: {
			collectedAmount: Number(collectedRows[0]?.value ?? 0),
			collectedCount: Number(collectedCountRows[0]?.value ?? 0),
			pendingCount: Number(pendingRows[0]?.value ?? 0),
			requiresActionCount: Number(requiresActionRows[0]?.value ?? 0),
			failedCount: Number(failedRows[0]?.value ?? 0),
			pendingDirectDebitCount: Number(pendingDirectDebitRows[0]?.value ?? 0),
			recurringPastDueCount: Number(recurringPastDueRows[0]?.value ?? 0),
			failedWebhookCount: Number(failedWebhookRows[0]?.value ?? 0),
		},
	})
}
