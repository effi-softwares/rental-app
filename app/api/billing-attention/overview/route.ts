import { and, count, desc, eq, inArray, type SQL, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { getScopedBranchIdsForViewer } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { rental, rentalPayment } from "@/lib/db/schema/rentals"
import {
	stripeWebhookEvent,
	workspaceRealtimeEvent,
} from "@/lib/db/schema/workspace"

function buildBranchScopedPredicate(
	column:
		| typeof rental.branchId
		| typeof rentalPayment.branchId
		| typeof stripeWebhookEvent.branchId
		| typeof workspaceRealtimeEvent.branchId,
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
	const guard = await requireViewer({
		permission: "manageBillingAttentionModule",
	})

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)
	const rentalBranchScope = buildBranchScopedPredicate(
		rental.branchId,
		scopedBranchIds,
	)
	const paymentBranchScope = buildBranchScopedPredicate(
		rentalPayment.branchId,
		scopedBranchIds,
	)
	const webhookBranchScope = buildBranchScopedPredicate(
		stripeWebhookEvent.branchId,
		scopedBranchIds,
	)
	const realtimeBranchScope = buildBranchScopedPredicate(
		workspaceRealtimeEvent.branchId,
		scopedBranchIds,
	)

	const [
		rentalsAwaitingPaymentRows,
		requiresActionRows,
		failedRows,
		becsRows,
		recentWebhookRows,
		recentAttentionRows,
	] = await Promise.all([
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
		db
			.select({
				id: stripeWebhookEvent.id,
				stripeEventId: stripeWebhookEvent.stripeEventId,
				type: stripeWebhookEvent.type,
				status: stripeWebhookEvent.status,
				mode: stripeWebhookEvent.mode,
				objectType: stripeWebhookEvent.objectType,
				objectId: stripeWebhookEvent.objectId,
				errorMessage: stripeWebhookEvent.errorMessage,
				receivedAt: stripeWebhookEvent.receivedAt,
				processedAt: stripeWebhookEvent.processedAt,
			})
			.from(stripeWebhookEvent)
			.where(
				and(
					eq(stripeWebhookEvent.organizationId, viewer.activeOrganizationId),
					webhookBranchScope,
				),
			)
			.orderBy(desc(stripeWebhookEvent.receivedAt))
			.limit(20),
		db
			.select({
				id: workspaceRealtimeEvent.id,
				topic: workspaceRealtimeEvent.topic,
				eventType: workspaceRealtimeEvent.eventType,
				entityType: workspaceRealtimeEvent.entityType,
				entityId: workspaceRealtimeEvent.entityId,
				payloadJson: workspaceRealtimeEvent.payloadJson,
				attention: workspaceRealtimeEvent.attention,
				summary: workspaceRealtimeEvent.summary,
				createdAt: workspaceRealtimeEvent.createdAt,
			})
			.from(workspaceRealtimeEvent)
			.where(
				and(
					eq(
						workspaceRealtimeEvent.organizationId,
						viewer.activeOrganizationId,
					),
					eq(workspaceRealtimeEvent.topic, "billing_attention"),
					inArray(workspaceRealtimeEvent.attention, ["warning", "critical"]),
					realtimeBranchScope,
				),
			)
			.orderBy(desc(workspaceRealtimeEvent.id))
			.limit(20),
	])

	const rentalsAwaitingPaymentCount = Number(
		rentalsAwaitingPaymentRows[0]?.value ?? 0,
	)
	const requiresActionPaymentsCount = Number(requiresActionRows[0]?.value ?? 0)
	const failedPaymentsCount = Number(failedRows[0]?.value ?? 0)
	const pendingDirectDebitCount = Number(becsRows[0]?.value ?? 0)
	const fallbackAttentionRows =
		recentAttentionRows.length > 0
			? []
			: await Promise.all([
					db
						.select({
							id: rental.id,
							entityType: sql<string>`'rental'`,
							entityId: rental.id,
							attention: sql<"warning">`'warning'`,
							summary: sql<string>`'Rental is awaiting payment.'`,
							createdAt: rental.updatedAt,
						})
						.from(rental)
						.where(
							and(
								eq(rental.organizationId, viewer.activeOrganizationId),
								eq(rental.status, "awaiting_payment"),
								rentalBranchScope,
							),
						)
						.orderBy(desc(rental.updatedAt))
						.limit(8),
					db
						.select({
							id: rentalPayment.id,
							entityType: sql<string>`'payment'`,
							entityId: rentalPayment.id,
							attention: sql<"warning">`'warning'`,
							summary: sql<string>`'Payment requires customer or operator action.'`,
							createdAt: rentalPayment.updatedAt,
						})
						.from(rentalPayment)
						.where(
							and(
								eq(rentalPayment.organizationId, viewer.activeOrganizationId),
								eq(rentalPayment.status, "requires_action"),
								paymentBranchScope,
							),
						)
						.orderBy(desc(rentalPayment.updatedAt))
						.limit(8),
					db
						.select({
							id: rentalPayment.id,
							entityType: sql<string>`'payment'`,
							entityId: rentalPayment.id,
							attention: sql<"critical">`'critical'`,
							summary: sql<string>`'Payment failed.'`,
							createdAt: rentalPayment.updatedAt,
						})
						.from(rentalPayment)
						.where(
							and(
								eq(rentalPayment.organizationId, viewer.activeOrganizationId),
								eq(rentalPayment.status, "failed"),
								paymentBranchScope,
							),
						)
						.orderBy(desc(rentalPayment.updatedAt))
						.limit(8),
					db
						.select({
							id: rentalPayment.id,
							entityType: sql<string>`'payment'`,
							entityId: rentalPayment.id,
							attention: sql<"warning">`'warning'`,
							summary: sql<string>`'Direct debit is still pending settlement.'`,
							createdAt: rentalPayment.updatedAt,
						})
						.from(rentalPayment)
						.where(
							and(
								eq(rentalPayment.organizationId, viewer.activeOrganizationId),
								eq(rentalPayment.status, "pending"),
								eq(rentalPayment.paymentMethodType, "au_becs_debit"),
								paymentBranchScope,
							),
						)
						.orderBy(desc(rentalPayment.updatedAt))
						.limit(8),
				]).then((groups) =>
					groups
						.flat()
						.sort(
							(left, right) =>
								right.createdAt.getTime() - left.createdAt.getTime(),
						)
						.slice(0, 20),
				)

	return NextResponse.json({
		summary: {
			openAttentionCount:
				rentalsAwaitingPaymentCount +
				requiresActionPaymentsCount +
				failedPaymentsCount +
				pendingDirectDebitCount,
			rentalsAwaitingPaymentCount,
			requiresActionPaymentsCount,
			failedPaymentsCount,
			pendingDirectDebitCount,
		},
		recentWebhookEvents: recentWebhookRows.map((row) => ({
			id: row.id,
			stripeEventId: row.stripeEventId,
			type: row.type,
			status: row.status,
			mode: row.mode,
			objectType: row.objectType,
			objectId: row.objectId,
			errorMessage: row.errorMessage,
			receivedAt: row.receivedAt.toISOString(),
			processedAt: row.processedAt?.toISOString() ?? null,
		})),
		recentAttentionEvents:
			recentAttentionRows.length > 0
				? recentAttentionRows.map((row) => ({
						id: String(row.id),
						topic: row.topic,
						eventType: row.eventType,
						entityType: row.entityType,
						entityId: row.entityId,
						stripeEventId:
							typeof row.payloadJson.stripeEventId === "string"
								? row.payloadJson.stripeEventId
								: null,
						attention: row.attention,
						summary: row.summary,
						createdAt: row.createdAt.toISOString(),
					}))
				: fallbackAttentionRows.map((row) => ({
						id: row.id,
						topic: "billing_attention" as const,
						eventType: "billing_attention.current_state",
						entityType: row.entityType,
						entityId: row.entityId,
						stripeEventId: null,
						attention: row.attention,
						summary: row.summary,
						createdAt: row.createdAt.toISOString(),
					})),
	})
}
