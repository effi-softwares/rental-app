import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm"

import type { PaymentLedgerRow } from "@/features/payments/types/payments"
import { getScopedBranchIdsForViewer } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import type { branch } from "@/lib/db/schema/branches"
import {
	type rental,
	rentalInvoice,
	rentalPayment,
} from "@/lib/db/schema/rentals"
import { stripeWebhookEvent } from "@/lib/db/schema/workspace"
import type { Context } from "@/types"
import { numericToNumber } from "../rentals/_lib"

export function buildBranchScopedPredicate(
	column:
		| typeof rental.branchId
		| typeof rentalPayment.branchId
		| typeof stripeWebhookEvent.branchId
		| typeof branch.id,
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

export async function getScopedPaymentAccess(
	viewer: Context & { activeOrganizationId: string },
) {
	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)

	return {
		scopedBranchIds,
		paymentBranchScope: buildBranchScopedPredicate(
			rentalPayment.branchId,
			scopedBranchIds,
		),
		webhookBranchScope: buildBranchScopedPredicate(
			stripeWebhookEvent.branchId,
			scopedBranchIds,
		),
	}
}

export async function resolveWebhookReferences(input: {
	organizationId: string
	objectIds: string[]
}) {
	if (input.objectIds.length === 0) {
		return {
			paymentByObjectId: new Map<
				string,
				{
					paymentId: string
					rentalId: string
					invoiceRecordId: string | null
				}
			>(),
			invoiceByObjectId: new Map<
				string,
				{ invoiceRecordId: string; rentalId: string }
			>(),
		}
	}

	const uniqueObjectIds = [...new Set(input.objectIds)]
	const paymentPredicates = [
		inArray(rentalPayment.stripePaymentIntentId, uniqueObjectIds),
		inArray(rentalPayment.stripeSetupIntentId, uniqueObjectIds),
		inArray(rentalPayment.stripeInvoiceId, uniqueObjectIds),
		inArray(rentalPayment.stripeSubscriptionId, uniqueObjectIds),
		inArray(rentalPayment.stripeSubscriptionScheduleId, uniqueObjectIds),
	].filter(Boolean)

	const [paymentRows, invoiceRows] = await Promise.all([
		paymentPredicates.length > 0
			? db
					.select({
						id: rentalPayment.id,
						rentalId: rentalPayment.rentalId,
						invoiceRecordId: rentalPayment.invoiceId,
						paymentIntentId: rentalPayment.stripePaymentIntentId,
						setupIntentId: rentalPayment.stripeSetupIntentId,
						invoiceId: rentalPayment.stripeInvoiceId,
						subscriptionId: rentalPayment.stripeSubscriptionId,
						subscriptionScheduleId: rentalPayment.stripeSubscriptionScheduleId,
					})
					.from(rentalPayment)
					.where(
						and(
							eq(rentalPayment.organizationId, input.organizationId),
							or(...paymentPredicates),
						),
					)
			: Promise.resolve([]),
		db
			.select({
				id: rentalInvoice.id,
				rentalId: rentalInvoice.rentalId,
				stripeInvoiceId: rentalInvoice.stripeInvoiceId,
			})
			.from(rentalInvoice)
			.where(
				and(
					eq(rentalInvoice.organizationId, input.organizationId),
					inArray(rentalInvoice.stripeInvoiceId, uniqueObjectIds),
				),
			),
	])

	const paymentByObjectId = new Map<
		string,
		{
			paymentId: string
			rentalId: string
			invoiceRecordId: string | null
		}
	>()
	for (const row of paymentRows) {
		for (const objectId of [
			row.paymentIntentId,
			row.setupIntentId,
			row.invoiceId,
			row.subscriptionId,
			row.subscriptionScheduleId,
		]) {
			if (!objectId || paymentByObjectId.has(objectId)) {
				continue
			}

			paymentByObjectId.set(objectId, {
				paymentId: row.id,
				rentalId: row.rentalId,
				invoiceRecordId: row.invoiceRecordId,
			})
		}
	}

	const invoiceByObjectId = new Map<
		string,
		{ invoiceRecordId: string; rentalId: string }
	>()
	for (const row of invoiceRows) {
		if (!row.stripeInvoiceId || invoiceByObjectId.has(row.stripeInvoiceId)) {
			continue
		}

		invoiceByObjectId.set(row.stripeInvoiceId, {
			invoiceRecordId: row.id,
			rentalId: row.rentalId,
		})
	}

	return {
		paymentByObjectId,
		invoiceByObjectId,
	}
}

export type PaymentLedgerSelectRow = {
	id: string
	rentalId: string
	rentalStatus: PaymentLedgerRow["rentalStatus"]
	rentalRecurringBillingState: PaymentLedgerRow["rentalRecurringBillingState"]
	paymentPlanKind: PaymentLedgerRow["paymentPlanKind"]
	branchId: string | null
	branchName: string | null
	customerId: string | null
	customerName: string | null
	customerEmail: string | null
	scheduleId: string | null
	scheduleLabel: string | null
	scheduleDueAt: Date | null
	scheduleStatus: PaymentLedgerRow["scheduleStatus"]
	scheduleFailureReason: string | null
	kind: PaymentLedgerRow["kind"]
	status: PaymentLedgerRow["status"]
	amount: unknown
	currency: string
	paymentMethodType: PaymentLedgerRow["paymentMethodType"]
	collectionSurface: PaymentLedgerRow["collectionSurface"]
	manualReference: string | null
	externalReference: string | null
	localInvoiceRecordId: string | null
	hostedInvoiceUrl: string | null
	invoicePdfUrl: string | null
	paymentIntentId: string | null
	setupIntentId: string | null
	invoiceId: string | null
	subscriptionId: string | null
	subscriptionScheduleId: string | null
	paymentMethodId: string | null
	capturedAt: Date | null
	createdAt: Date
	updatedAt: Date
}

export function mapPaymentLedgerRow(
	row: PaymentLedgerSelectRow,
): PaymentLedgerRow {
	return {
		id: row.id,
		rentalId: row.rentalId,
		rentalStatus: row.rentalStatus,
		rentalRecurringBillingState: row.rentalRecurringBillingState,
		paymentPlanKind: row.paymentPlanKind,
		branchId: row.branchId,
		branchName: row.branchName,
		customerId: row.customerId,
		customerName: row.customerName,
		customerEmail: row.customerEmail,
		scheduleId: row.scheduleId,
		scheduleLabel: row.scheduleLabel,
		scheduleDueAt: row.scheduleDueAt?.toISOString() ?? null,
		scheduleStatus: row.scheduleStatus,
		scheduleFailureReason: row.scheduleFailureReason,
		kind: row.kind,
		status: row.status,
		amount: numericToNumber(row.amount),
		currency: row.currency,
		paymentMethodType: row.paymentMethodType,
		collectionSurface: row.collectionSurface,
		manualReference: row.manualReference,
		externalReference: row.externalReference,
		localInvoiceRecordId: row.localInvoiceRecordId,
		hostedInvoiceUrl: row.hostedInvoiceUrl,
		invoicePdfUrl: row.invoicePdfUrl,
		paymentIntentId: row.paymentIntentId,
		setupIntentId: row.setupIntentId,
		invoiceId: row.invoiceId,
		subscriptionId: row.subscriptionId,
		subscriptionScheduleId: row.subscriptionScheduleId,
		paymentMethodId: row.paymentMethodId,
		capturedAt: row.capturedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}
}
