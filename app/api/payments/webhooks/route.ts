import { and, desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { stripeWebhookEvent } from "@/lib/db/schema/workspace"
import { getScopedPaymentAccess, resolveWebhookReferences } from "../_lib"

export async function GET(request: Request) {
	const guard = await requireViewer({ permission: "managePaymentsModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const { webhookBranchScope } = await getScopedPaymentAccess(viewer)
	const url = new URL(request.url)
	const statusFilter =
		url.searchParams.get("status") === "failed" ? "failed" : "all"

	const rows = await db
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
			organizationId: stripeWebhookEvent.organizationId,
			branchId: stripeWebhookEvent.branchId,
			branchName: branch.name,
			payload: stripeWebhookEvent.payloadJson,
		})
		.from(stripeWebhookEvent)
		.leftJoin(branch, eq(stripeWebhookEvent.branchId, branch.id))
		.where(
			and(
				eq(stripeWebhookEvent.organizationId, viewer.activeOrganizationId),
				statusFilter === "failed"
					? eq(stripeWebhookEvent.status, "failed")
					: undefined,
				webhookBranchScope,
			),
		)
		.orderBy(desc(stripeWebhookEvent.receivedAt))
		.limit(statusFilter === "failed" ? 50 : 25)

	const references = await resolveWebhookReferences({
		organizationId: viewer.activeOrganizationId,
		objectIds: rows
			.map((row) => row.objectId)
			.filter((value): value is string => Boolean(value)),
	})

	return NextResponse.json({
		filter: {
			status: statusFilter,
		},
		rows: rows.map((row) => {
			const paymentRef = row.objectId
				? references.paymentByObjectId.get(row.objectId)
				: undefined
			const invoiceRef = row.objectId
				? references.invoiceByObjectId.get(row.objectId)
				: undefined

			return {
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
				organizationId: row.organizationId,
				branchId: row.branchId,
				branchName: row.branchName,
				relatedRentalId: paymentRef?.rentalId ?? invoiceRef?.rentalId ?? null,
				relatedPaymentId: paymentRef?.paymentId ?? null,
				relatedInvoiceRecordId:
					invoiceRef?.invoiceRecordId ?? paymentRef?.invoiceRecordId ?? null,
				payload: row.payload,
			}
		}),
	})
}
