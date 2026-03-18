import { and, eq, inArray } from "drizzle-orm"
import type Stripe from "stripe"

import { db } from "@/lib/db"
import {
	rental,
	rentalInvoice,
	rentalPayment,
	rentalPaymentRefund,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import { requireStripeServer } from "@/lib/stripe/server"
import { releaseRentalDraftHold } from "./availability"

type RentalCancellationReason = NonNullable<
	typeof rental.$inferSelect.cancellationReason
>

type RentalRecord = typeof rental.$inferSelect
type RentalPaymentRecord = typeof rentalPayment.$inferSelect
type RentalPaymentRefundRecord = typeof rentalPaymentRefund.$inferSelect

function mapStripeRefundStatus(
	status: Stripe.Refund["status"] | null | undefined,
): typeof rentalPaymentRefund.$inferSelect.status {
	switch (status) {
		case "succeeded":
			return "succeeded"
		case "failed":
			return "failed"
		case "canceled":
			return "cancelled"
		default:
			return "processing"
	}
}

function extractStripeRefundReference(refund: Stripe.Refund) {
	const destinationDetails = refund.destination_details
	if (!destinationDetails || typeof destinationDetails !== "object") {
		return null
	}

	const cardDetails =
		"card" in destinationDetails &&
		destinationDetails.card &&
		typeof destinationDetails.card === "object"
			? destinationDetails.card
			: null

	if (
		cardDetails &&
		"reference" in cardDetails &&
		typeof cardDetails.reference === "string"
	) {
		return cardDetails.reference
	}

	const euBankTransferDetails =
		"eu_bank_transfer" in destinationDetails &&
		destinationDetails.eu_bank_transfer &&
		typeof destinationDetails.eu_bank_transfer === "object"
			? destinationDetails.eu_bank_transfer
			: null

	if (
		euBankTransferDetails &&
		"reference" in euBankTransferDetails &&
		typeof euBankTransferDetails.reference === "string"
	) {
		return euBankTransferDetails.reference
	}

	return null
}

async function voidStripeInvoiceIfPossible(
	stripe: Stripe,
	stripeInvoiceId: string,
) {
	try {
		const invoice = await stripe.invoices.retrieve(stripeInvoiceId)

		if (invoice.status === "draft") {
			await stripe.invoices.del(stripeInvoiceId)
			return true
		}

		if (invoice.status === "open" || invoice.status === "uncollectible") {
			await stripe.invoices.voidInvoice(stripeInvoiceId)
			return true
		}
	} catch {
		return false
	}

	return false
}

async function markPaymentAsRefunded(input: {
	paymentId: string
	refundedAt?: Date
}) {
	await db
		.update(rentalPayment)
		.set({
			status: "refunded",
			refundedAt: input.refundedAt ?? new Date(),
			updatedAt: new Date(),
		})
		.where(eq(rentalPayment.id, input.paymentId))
}

async function getLatestRefundsForRental(
	organizationId: string,
	rentalId: string,
) {
	const rows = await db
		.select()
		.from(rentalPaymentRefund)
		.where(
			and(
				eq(rentalPaymentRefund.organizationId, organizationId),
				eq(rentalPaymentRefund.rentalId, rentalId),
			),
		)

	return rows.reduce<Map<string, RentalPaymentRefundRecord>>((map, row) => {
		const existing = map.get(row.paymentId)
		if (!existing || existing.createdAt < row.createdAt) {
			map.set(row.paymentId, row)
		}
		return map
	}, new Map())
}

async function createStripeRefundForPayment(input: {
	rentalRecord: RentalRecord
	payment: RentalPaymentRecord
}) {
	if (
		!input.payment.stripePaymentIntentId &&
		!input.payment.stripeChargeId &&
		!input.payment.stripeInvoiceId
	) {
		return null
	}

	const stripe = requireStripeServer()
	const now = new Date()
	try {
		const refund = await stripe.refunds.create(
			{
				payment_intent: input.payment.stripePaymentIntentId ?? undefined,
				charge: input.payment.stripeChargeId ?? undefined,
				metadata: {
					organizationId: input.rentalRecord.organizationId,
					rentalId: input.rentalRecord.id,
					paymentId: input.payment.id,
				},
			},
			{
				idempotencyKey: `${input.rentalRecord.organizationId}:${input.rentalRecord.id}:${input.payment.id}:full_refund`,
			},
		)

		const [refundRecord] = await db
			.insert(rentalPaymentRefund)
			.values({
				organizationId: input.rentalRecord.organizationId,
				branchId: input.payment.branchId,
				rentalId: input.rentalRecord.id,
				paymentId: input.payment.id,
				provider: "stripe",
				status: mapStripeRefundStatus(refund.status),
				amount: Number(input.payment.amount).toFixed(2),
				currency: input.payment.currency,
				stripeRefundId: refund.id,
				reference: extractStripeRefundReference(refund),
				failureReason: refund.failure_reason ?? null,
				metadata: {
					paymentIntentId: input.payment.stripePaymentIntentId,
					chargeId: input.payment.stripeChargeId,
					refundStatus: refund.status,
				},
				updatedAt: now,
			})
			.returning()

		if (refundRecord.status === "succeeded") {
			await markPaymentAsRefunded({
				paymentId: input.payment.id,
				refundedAt: now,
			})
		}

		return refundRecord
	} catch (error) {
		const [refundRecord] = await db
			.insert(rentalPaymentRefund)
			.values({
				organizationId: input.rentalRecord.organizationId,
				branchId: input.payment.branchId,
				rentalId: input.rentalRecord.id,
				paymentId: input.payment.id,
				provider: "stripe",
				status: "failed",
				amount: Number(input.payment.amount).toFixed(2),
				currency: input.payment.currency,
				failureReason:
					error instanceof Error
						? error.message
						: "Stripe refund could not be created.",
				metadata: {
					paymentIntentId: input.payment.stripePaymentIntentId,
					chargeId: input.payment.stripeChargeId,
				},
				updatedAt: now,
			})
			.returning()

		return refundRecord
	}
}

async function createPendingCashRefundForPayment(input: {
	rentalRecord: RentalRecord
	payment: RentalPaymentRecord
}) {
	const [refundRecord] = await db
		.insert(rentalPaymentRefund)
		.values({
			organizationId: input.rentalRecord.organizationId,
			branchId: input.payment.branchId,
			rentalId: input.rentalRecord.id,
			paymentId: input.payment.id,
			provider: "manual",
			status: "pending",
			amount: Number(input.payment.amount).toFixed(2),
			currency: input.payment.currency,
			reference: input.payment.manualReference,
			metadata: {
				paymentMethodType: input.payment.paymentMethodType,
				collectionSurface: input.payment.collectionSurface,
			},
		})
		.returning()

	return refundRecord
}

async function finalizeRentalCancellationIfReady(input: {
	rentalRecord: RentalRecord
	payments: RentalPaymentRecord[]
	refundsByPaymentId: Map<string, RentalPaymentRefundRecord>
}) {
	const unresolvedPayments = input.payments.some((payment) =>
		["pending", "requires_action", "processing"].includes(payment.status),
	)
	const unresolvedRefunds = [...input.refundsByPaymentId.values()].some(
		(refund) => ["pending", "processing", "failed"].includes(refund.status),
	)
	const succeededPaidPaymentsWithoutRefund = input.payments.some((payment) => {
		if (payment.status !== "succeeded" || Number(payment.amount) <= 0) {
			return false
		}

		return !input.refundsByPaymentId.has(payment.id)
	})

	if (
		unresolvedPayments ||
		unresolvedRefunds ||
		succeededPaidPaymentsWithoutRefund
	) {
		return false
	}

	const now = new Date()
	await db
		.update(rental)
		.set({
			status: "cancelled",
			recurringBillingState: "cancelled",
			cancellationCompletedAt: now,
			updatedAt: now,
		})
		.where(eq(rental.id, input.rentalRecord.id))

	await releaseRentalDraftHold({
		organizationId: input.rentalRecord.organizationId,
		rentalId: input.rentalRecord.id,
		memberId: input.rentalRecord.cancellationCompletedByMemberId,
	})

	return true
}

export async function resetPendingBillingArtifactsForDraftEdit(input: {
	organizationId: string
	rentalId: string
}) {
	const existingPaymentRows = await db
		.select({
			id: rentalPayment.id,
			status: rentalPayment.status,
			stripePaymentIntentId: rentalPayment.stripePaymentIntentId,
			stripeSetupIntentId: rentalPayment.stripeSetupIntentId,
			stripeSubscriptionScheduleId: rentalPayment.stripeSubscriptionScheduleId,
		})
		.from(rentalPayment)
		.where(
			and(
				eq(rentalPayment.organizationId, input.organizationId),
				eq(rentalPayment.rentalId, input.rentalId),
			),
		)

	const stripe = existingPaymentRows.some(
		(row) =>
			row.stripePaymentIntentId ||
			row.stripeSetupIntentId ||
			row.stripeSubscriptionScheduleId,
	)
		? requireStripeServer()
		: null

	if (stripe) {
		for (const paymentRow of existingPaymentRows) {
			if (paymentRow.stripeSubscriptionScheduleId) {
				try {
					await stripe.subscriptionSchedules.cancel(
						paymentRow.stripeSubscriptionScheduleId,
					)
				} catch {}
			}

			if (
				paymentRow.stripePaymentIntentId &&
				!["succeeded", "refunded", "cancelled"].includes(paymentRow.status)
			) {
				try {
					await stripe.paymentIntents.cancel(paymentRow.stripePaymentIntentId)
				} catch {}
			}

			if (
				paymentRow.stripeSetupIntentId &&
				!["succeeded", "cancelled"].includes(paymentRow.status)
			) {
				try {
					await stripe.setupIntents.cancel(paymentRow.stripeSetupIntentId)
				} catch {}
			}
		}
	}

	await db
		.update(rentalPayment)
		.set({
			status: "cancelled",
			stripeSubscriptionScheduleId: null,
			stripeSubscriptionId: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rentalPayment.organizationId, input.organizationId),
				eq(rentalPayment.rentalId, input.rentalId),
				inArray(rentalPayment.status, [
					"pending",
					"requires_action",
					"processing",
					"failed",
				]),
			),
		)

	await db
		.update(rentalPaymentSchedule)
		.set({
			status: "pending",
			stripeInvoiceId: null,
			stripeSubscriptionId: null,
			failureReason: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, input.organizationId),
				eq(rentalPaymentSchedule.rentalId, input.rentalId),
			),
		)

	await db
		.update(rental)
		.set({
			selectedPaymentMethodType: null,
			storedPaymentMethodStatus: "none",
			recurringBillingState: "none",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rental.organizationId, input.organizationId),
				eq(rental.id, input.rentalId),
			),
		)
}

export async function continueCancellingRental(input: {
	organizationId: string
	rentalId: string
}) {
	const rentalRecord = await db
		.select()
		.from(rental)
		.where(
			and(
				eq(rental.organizationId, input.organizationId),
				eq(rental.id, input.rentalId),
			),
		)
		.limit(1)
		.then((rows) => rows[0] ?? null)

	if (!rentalRecord || rentalRecord.status !== "cancelling") {
		return
	}

	const [payments, refundRows, invoiceRows] = await Promise.all([
		db
			.select()
			.from(rentalPayment)
			.where(
				and(
					eq(rentalPayment.organizationId, input.organizationId),
					eq(rentalPayment.rentalId, input.rentalId),
				),
			),
		db
			.select()
			.from(rentalPaymentRefund)
			.where(
				and(
					eq(rentalPaymentRefund.organizationId, input.organizationId),
					eq(rentalPaymentRefund.rentalId, input.rentalId),
				),
			),
		db
			.select()
			.from(rentalInvoice)
			.where(
				and(
					eq(rentalInvoice.organizationId, input.organizationId),
					eq(rentalInvoice.rentalId, input.rentalId),
				),
			),
	])

	const stripeIds = new Set<string>()
	const stripeInvoiceIds = new Set<string>()
	for (const payment of payments) {
		if (payment.stripeSubscriptionScheduleId) {
			stripeIds.add(payment.stripeSubscriptionScheduleId)
		}

		if (payment.stripePaymentIntentId) {
			stripeIds.add(payment.stripePaymentIntentId)
		}

		if (payment.stripeSetupIntentId) {
			stripeIds.add(payment.stripeSetupIntentId)
		}

		if (payment.stripeInvoiceId) {
			stripeInvoiceIds.add(payment.stripeInvoiceId)
		}
	}

	for (const invoiceRow of invoiceRows) {
		if (invoiceRow.stripeInvoiceId) {
			stripeInvoiceIds.add(invoiceRow.stripeInvoiceId)
		}
	}

	const stripe =
		stripeIds.size > 0 || stripeInvoiceIds.size > 0
			? requireStripeServer()
			: null

	if (stripe) {
		for (const payment of payments) {
			if (payment.stripeSubscriptionScheduleId) {
				try {
					await stripe.subscriptionSchedules.cancel(
						payment.stripeSubscriptionScheduleId,
					)
				} catch {}
			}

			if (
				payment.stripePaymentIntentId &&
				["pending", "requires_action", "failed"].includes(payment.status)
			) {
				try {
					await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
					await db
						.update(rentalPayment)
						.set({
							status: "cancelled",
							updatedAt: new Date(),
						})
						.where(eq(rentalPayment.id, payment.id))
				} catch {}
			}

			if (
				payment.stripeSetupIntentId &&
				["pending", "requires_action", "failed"].includes(payment.status)
			) {
				try {
					await stripe.setupIntents.cancel(payment.stripeSetupIntentId)
					await db
						.update(rentalPayment)
						.set({
							status: "cancelled",
							updatedAt: new Date(),
						})
						.where(eq(rentalPayment.id, payment.id))
				} catch {}
			}
		}

		for (const stripeInvoiceId of stripeInvoiceIds) {
			await voidStripeInvoiceIfPossible(stripe, stripeInvoiceId)
		}
	}

	await db
		.update(rentalPaymentSchedule)
		.set({
			status: "cancelled",
			failureReason: "Rental was cancelled before handover.",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, input.organizationId),
				eq(rentalPaymentSchedule.rentalId, input.rentalId),
				inArray(rentalPaymentSchedule.status, [
					"pending",
					"processing",
					"failed",
				]),
			),
		)

	await db
		.update(rentalInvoice)
		.set({
			status: "cancelled",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rentalInvoice.organizationId, input.organizationId),
				eq(rentalInvoice.rentalId, input.rentalId),
				inArray(rentalInvoice.status, ["draft", "open", "uncollectible"]),
			),
		)

	const refundsByPaymentId = refundRows.reduce<
		Map<string, RentalPaymentRefundRecord>
	>((map, row) => {
		const existing = map.get(row.paymentId)
		if (!existing || existing.createdAt < row.createdAt) {
			map.set(row.paymentId, row)
		}
		return map
	}, new Map())

	for (const payment of payments) {
		if (payment.status !== "succeeded" || Number(payment.amount) <= 0) {
			continue
		}

		if (refundsByPaymentId.has(payment.id)) {
			continue
		}

		const refundRecord =
			payment.paymentMethodType === "cash"
				? await createPendingCashRefundForPayment({
						rentalRecord,
						payment,
					})
				: await createStripeRefundForPayment({
						rentalRecord,
						payment,
					})

		if (refundRecord) {
			refundsByPaymentId.set(payment.id, refundRecord)
		}
	}

	const refreshedPayments = await db
		.select()
		.from(rentalPayment)
		.where(
			and(
				eq(rentalPayment.organizationId, input.organizationId),
				eq(rentalPayment.rentalId, input.rentalId),
			),
		)

	const latestRefunds = await getLatestRefundsForRental(
		input.organizationId,
		input.rentalId,
	)

	const completed = await finalizeRentalCancellationIfReady({
		rentalRecord,
		payments: refreshedPayments,
		refundsByPaymentId: latestRefunds,
	})

	if (completed) {
		await db
			.update(rental)
			.set({
				cancellationCompletedByMemberId:
					rentalRecord.cancellationCompletedByMemberId ??
					rentalRecord.cancellationRequestedByMemberId,
				updatedAt: new Date(),
			})
			.where(eq(rental.id, rentalRecord.id))
	}
}

export async function cancelRentalBeforeHandover(input: {
	organizationId: string
	rentalId: string
	reason: RentalCancellationReason
	note?: string | null
	requestedByMemberId?: string | null
}) {
	const now = new Date()
	await db
		.update(rental)
		.set({
			status: "cancelling",
			cancellationReason: input.reason,
			cancellationNote: input.note?.trim() || null,
			cancellationRequestedAt: now,
			cancellationCompletedAt: null,
			recurringBillingState: "cancelled",
			cancellationRequestedByMemberId: input.requestedByMemberId ?? null,
			cancellationCompletedByMemberId: null,
			updatedAt: now,
		})
		.where(
			and(
				eq(rental.organizationId, input.organizationId),
				eq(rental.id, input.rentalId),
			),
		)

	await continueCancellingRental({
		organizationId: input.organizationId,
		rentalId: input.rentalId,
	})
}

export async function confirmCashRefundForRental(input: {
	organizationId: string
	rentalId: string
	refundId: string
	confirmedByMemberId?: string | null
}) {
	const now = new Date()
	const refundRows = await db
		.select()
		.from(rentalPaymentRefund)
		.where(
			and(
				eq(rentalPaymentRefund.organizationId, input.organizationId),
				eq(rentalPaymentRefund.rentalId, input.rentalId),
				eq(rentalPaymentRefund.id, input.refundId),
			),
		)
		.limit(1)

	const refund = refundRows[0]
	if (!refund || refund.provider !== "manual" || refund.status !== "pending") {
		return null
	}

	const [updatedRefund] = await db
		.update(rentalPaymentRefund)
		.set({
			status: "succeeded",
			confirmedAt: now,
			confirmedByMemberId: input.confirmedByMemberId ?? null,
			updatedAt: now,
		})
		.where(eq(rentalPaymentRefund.id, refund.id))
		.returning()

	await markPaymentAsRefunded({
		paymentId: refund.paymentId,
		refundedAt: now,
	})

	await db
		.update(rental)
		.set({
			cancellationCompletedByMemberId: input.confirmedByMemberId ?? null,
			updatedAt: now,
		})
		.where(eq(rental.id, input.rentalId))

	await continueCancellingRental({
		organizationId: input.organizationId,
		rentalId: input.rentalId,
	})

	return updatedRefund
}
