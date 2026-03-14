import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import type {
	PaymentLedgerFilters,
	PaymentLedgerPreset,
} from "@/features/payments/types/payments"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { customer } from "@/lib/db/schema/customers"
import {
	rental,
	rentalInvoice,
	rentalPayment,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import {
	getScopedPaymentAccess,
	mapPaymentLedgerRow,
	type PaymentLedgerSelectRow,
	parsePageParam,
	parsePageSizeParam,
} from "../_lib"

function parsePreset(value: string | null): PaymentLedgerPreset {
	switch (value) {
		case "cash":
		case "terminal_card":
		case "direct_debit":
		case "installments":
		case "failures":
		case "awaiting_settlement":
			return value
		default:
			return "all"
	}
}

function buildPresetPredicate(preset: PaymentLedgerPreset) {
	switch (preset) {
		case "cash":
			return eq(rentalPayment.paymentMethodType, "cash")
		case "terminal_card":
			return and(
				eq(rentalPayment.paymentMethodType, "card"),
				eq(rentalPayment.collectionSurface, "terminal_reader"),
			)
		case "direct_debit":
			return eq(rentalPayment.paymentMethodType, "au_becs_debit")
		case "installments":
			return eq(rental.paymentPlanKind, "installment")
		case "failures":
			return or(
				inArray(rentalPayment.status, [
					"failed",
					"cancelled",
					"refunded",
					"requires_action",
				]),
				inArray(rental.recurringBillingState, ["failed", "past_due"]),
				sql`${rentalPaymentSchedule.failureReason} is not null`,
			)
		case "awaiting_settlement":
			return inArray(rentalPayment.status, [
				"pending",
				"processing",
				"requires_action",
			])
		default:
			return undefined
	}
}

function buildSearchPredicate(search: string) {
	if (!search) {
		return undefined
	}

	const pattern = `%${search}%`
	return or(
		ilike(customer.fullName, pattern),
		ilike(customer.email, pattern),
		ilike(branch.name, pattern),
		ilike(rentalPayment.manualReference, pattern),
		ilike(rentalPayment.externalReference, pattern),
		ilike(rentalPayment.stripePaymentIntentId, pattern),
		ilike(rentalPayment.stripeSetupIntentId, pattern),
		ilike(rentalPayment.stripeInvoiceId, pattern),
		ilike(rentalPayment.stripeSubscriptionId, pattern),
		ilike(rentalPayment.stripeSubscriptionScheduleId, pattern),
		sql`cast(${rentalPayment.id} as text) ilike ${pattern}`,
		sql`cast(${rentalPayment.rentalId} as text) ilike ${pattern}`,
	)
}

export async function GET(request: Request) {
	const guard = await requireViewer({ permission: "managePaymentsModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const { paymentBranchScope } = await getScopedPaymentAccess(viewer)
	const url = new URL(request.url)
	const preset = parsePreset(url.searchParams.get("preset"))
	const search = url.searchParams.get("search")?.trim() ?? ""
	const page = parsePageParam(url.searchParams.get("page"), 1)
	const pageSize = parsePageSizeParam(url.searchParams.get("pageSize"), 25)
	const presetPredicate = buildPresetPredicate(preset)
	const searchPredicate = buildSearchPredicate(search)

	const predicates = [
		eq(rentalPayment.organizationId, viewer.activeOrganizationId),
		paymentBranchScope,
		presetPredicate,
		searchPredicate,
	].filter(Boolean)

	const [totalRows, rows] = await Promise.all([
		db
			.select({ value: count() })
			.from(rentalPayment)
			.innerJoin(rental, eq(rentalPayment.rentalId, rental.id))
			.leftJoin(customer, eq(rental.customerId, customer.id))
			.leftJoin(branch, eq(rentalPayment.branchId, branch.id))
			.leftJoin(
				rentalPaymentSchedule,
				eq(rentalPayment.scheduleId, rentalPaymentSchedule.id),
			)
			.where(and(...predicates)),
		db
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
			.where(and(...predicates))
			.orderBy(desc(rentalPayment.createdAt))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
	])

	const total = Number(totalRows[0]?.value ?? 0)

	return NextResponse.json({
		filters: {
			preset,
			search,
			page,
			pageSize,
		} satisfies Required<PaymentLedgerFilters>,
		page: {
			page,
			pageSize,
			total,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
		},
		rows: rows.map((row) => mapPaymentLedgerRow(row as PaymentLedgerSelectRow)),
	})
}
