import { and, desc, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { customer } from "@/lib/db/schema/customers"
import {
	rental,
	rentalEvent,
	rentalInvoice,
	rentalPayment,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import { stripeWebhookEvent } from "@/lib/db/schema/workspace"
import { getRentalDetailResponse } from "../../rentals/_flow"
import {
	getScopedPaymentAccess,
	mapPaymentLedgerRow,
	type PaymentLedgerSelectRow,
	resolveWebhookReferences,
} from "../_lib"

type RouteProps = {
	params: Promise<{
		paymentId: string
	}>
}

async function getPaymentRowsForRental(input: {
	organizationId: string
	rentalId: string
}) {
	return db
		.select({
			id: rentalPayment.id,
			rentalId: rentalPayment.rentalId,
			rentalStatus: rental.status,
			rentalRecurringBillingState: rental.recurringBillingState,
			paymentPlanKind: rental.paymentPlanKind,
			branchId: rentalPayment.branchId,
			branchName: branch.name,
			customerId: rental.customerId,
			customerName: customer.fullName,
			customerEmail: customer.email,
			scheduleId: rentalPayment.scheduleId,
			scheduleLabel: rentalPaymentSchedule.label,
			scheduleDueAt: rentalPaymentSchedule.dueAt,
			scheduleStatus: rentalPaymentSchedule.status,
			scheduleFailureReason: rentalPaymentSchedule.failureReason,
			kind: rentalPayment.kind,
			status: rentalPayment.status,
			amount: rentalPayment.amount,
			currency: rentalPayment.currency,
			paymentMethodType: rentalPayment.paymentMethodType,
			collectionSurface: rentalPayment.collectionSurface,
			manualReference: rentalPayment.manualReference,
			externalReference: rentalPayment.externalReference,
			localInvoiceRecordId: rentalPayment.invoiceId,
			hostedInvoiceUrl: rentalInvoice.hostedInvoiceUrl,
			invoicePdfUrl: rentalInvoice.invoicePdfUrl,
			paymentIntentId: rentalPayment.stripePaymentIntentId,
			setupIntentId: rentalPayment.stripeSetupIntentId,
			invoiceId: rentalPayment.stripeInvoiceId,
			subscriptionId: rentalPayment.stripeSubscriptionId,
			subscriptionScheduleId: rentalPayment.stripeSubscriptionScheduleId,
			paymentMethodId: rentalPayment.stripePaymentMethodId,
			capturedAt: rentalPayment.capturedAt,
			createdAt: rentalPayment.createdAt,
			updatedAt: rentalPayment.updatedAt,
		})
		.from(rentalPayment)
		.innerJoin(rental, eq(rentalPayment.rentalId, rental.id))
		.leftJoin(customer, eq(rental.customerId, customer.id))
		.leftJoin(branch, eq(rentalPayment.branchId, branch.id))
		.leftJoin(
			rentalPaymentSchedule,
			eq(rentalPayment.scheduleId, rentalPaymentSchedule.id),
		)
		.leftJoin(rentalInvoice, eq(rentalPayment.invoiceId, rentalInvoice.id))
		.where(
			and(
				eq(rentalPayment.organizationId, input.organizationId),
				eq(rentalPayment.rentalId, input.rentalId),
			),
		)
		.orderBy(desc(rentalPayment.createdAt))
}

export async function GET(_: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "managePaymentsModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const { paymentId } = await params
	const { paymentBranchScope, webhookBranchScope } =
		await getScopedPaymentAccess(viewer)

	const matchedRows = await db
		.select({
			id: rentalPayment.id,
			rentalId: rentalPayment.rentalId,
		})
		.from(rentalPayment)
		.where(
			and(
				eq(rentalPayment.organizationId, viewer.activeOrganizationId),
				eq(rentalPayment.id, paymentId),
				paymentBranchScope,
			),
		)
		.limit(1)

	const matched = matchedRows[0]
	if (!matched) {
		return NextResponse.json(
			{ error: "Payment was not found." },
			{ status: 404 },
		)
	}

	const [paymentRows, rentalDetail, rentalEvents] = await Promise.all([
		getPaymentRowsForRental({
			organizationId: viewer.activeOrganizationId,
			rentalId: matched.rentalId,
		}),
		getRentalDetailResponse(viewer, matched.rentalId),
		db
			.select({
				id: rentalEvent.id,
				type: rentalEvent.type,
				createdAt: rentalEvent.createdAt,
				payload: rentalEvent.payloadJson,
			})
			.from(rentalEvent)
			.where(
				and(
					eq(rentalEvent.organizationId, viewer.activeOrganizationId),
					eq(rentalEvent.rentalId, matched.rentalId),
				),
			)
			.orderBy(desc(rentalEvent.createdAt))
			.limit(30),
	])

	if ("error" in rentalDetail) {
		return rentalDetail.error
	}

	const relatedPayments = paymentRows.map((row) =>
		mapPaymentLedgerRow(row as PaymentLedgerSelectRow),
	)
	const selectedPayment = relatedPayments.find((row) => row.id === paymentId)

	if (!selectedPayment) {
		return NextResponse.json(
			{ error: "Payment was not found." },
			{ status: 404 },
		)
	}

	const correlatedObjectIds = [
		selectedPayment.paymentIntentId,
		selectedPayment.setupIntentId,
		selectedPayment.invoiceId,
		selectedPayment.subscriptionId,
		selectedPayment.subscriptionScheduleId,
		rentalDetail.invoice?.stripeInvoiceId ?? null,
		...rentalDetail.paymentSchedule.flatMap((row) => [
			row.stripeInvoiceId,
			row.stripeSubscriptionId,
		]),
	]
		.filter((value): value is string => Boolean(value))
		.filter((value, index, all) => all.indexOf(value) === index)

	const webhookRows = correlatedObjectIds.length
		? await db
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
						inArray(stripeWebhookEvent.objectId, correlatedObjectIds),
						webhookBranchScope,
					),
				)
				.orderBy(desc(stripeWebhookEvent.receivedAt))
				.limit(50)
		: []

	const webhookReferences = await resolveWebhookReferences({
		organizationId: viewer.activeOrganizationId,
		objectIds: webhookRows
			.map((row) => row.objectId)
			.filter((value): value is string => Boolean(value)),
	})

	return NextResponse.json({
		selectedPayment,
		rental: {
			id: rentalDetail.rental.id,
			status: rentalDetail.rental.status,
			paymentPlanKind: rentalDetail.rental.paymentPlanKind,
			selectedPaymentMethodType: rentalDetail.rental.selectedPaymentMethodType,
			recurringBillingState: rentalDetail.rental.recurringBillingState,
			plannedStartAt: rentalDetail.rental.plannedStartAt,
			plannedEndAt: rentalDetail.rental.plannedEndAt,
			actualStartAt: rentalDetail.rental.actualStartAt,
			actualEndAt: rentalDetail.rental.actualEndAt,
			branchId: rentalDetail.rental.branchId,
			customerId: rentalDetail.rental.customerId,
			customerName: rentalDetail.customer?.fullName ?? null,
			customerEmail: rentalDetail.customer?.email ?? null,
		},
		relatedSchedule:
			rentalDetail.paymentSchedule.find(
				(row) => row.id === selectedPayment.scheduleId,
			) ?? null,
		fullSchedule: rentalDetail.paymentSchedule,
		relatedInvoice: rentalDetail.invoice
			? {
					id: rentalDetail.invoice.id,
					status: rentalDetail.invoice.status,
					collectionMethod: rentalDetail.invoice.collectionMethod,
					currency: rentalDetail.invoice.currency,
					stripeInvoiceId: rentalDetail.invoice.stripeInvoiceId,
					hostedInvoiceUrl: rentalDetail.invoice.hostedInvoiceUrl,
					invoicePdfUrl: rentalDetail.invoice.invoicePdfUrl,
					total: rentalDetail.invoice.total,
					issuedAt: rentalDetail.invoice.issuedAt,
					dueAt: rentalDetail.invoice.dueAt,
				}
			: null,
		correlatedWebhooks: webhookRows.map((row) => {
			const paymentRef = row.objectId
				? webhookReferences.paymentByObjectId.get(row.objectId)
				: undefined
			const invoiceRef = row.objectId
				? webhookReferences.invoiceByObjectId.get(row.objectId)
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
		relatedRentalEvents: rentalEvents.map((row) => ({
			id: row.id,
			type: row.type,
			createdAt: row.createdAt.toISOString(),
			payload: row.payload,
		})),
		relatedPayments,
	})
}
