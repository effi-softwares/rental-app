import { and, asc, eq, inArray, or, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { jsonError } from "@/lib/api/errors"
import { db } from "@/lib/db"
import {
	rental,
	rentalInvoice,
	rentalPayment,
	rentalPaymentRefund,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import { stripeWebhookEvent } from "@/lib/db/schema/workspace"
import { continueCancellingRental } from "@/lib/rentals/cancellation"
import { requireStripeServer } from "@/lib/stripe/server"
import {
	publishWorkspaceRealtimeEvents,
	type WorkspaceRealtimeEventInput,
} from "@/lib/workspace-live/server"

type WebhookContext = {
	organizationId: string | null
	branchId: string | null
	rentalId: string | null
}

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0]

function buildBillingAttentionRealtimeEvents(input: {
	event: Stripe.Event
	context: WebhookContext
	status: typeof stripeWebhookEvent.$inferSelect.status
	errorMessage: string | null
}): WorkspaceRealtimeEventInput[] {
	if (!input.context.organizationId) {
		return []
	}

	const eventObject = input.event.data.object as unknown as Record<
		string,
		unknown
	>
	const entityType =
		typeof eventObject.object === "string"
			? eventObject.object
			: "stripe_object"
	const entityId =
		typeof eventObject.id === "string"
			? eventObject.id
			: (input.context.rentalId ?? input.event.id)

	if (input.status === "failed") {
		return [
			{
				organizationId: input.context.organizationId,
				branchId: input.context.branchId,
				topic: "billing_attention",
				eventType: input.event.type,
				entityType,
				entityId,
				attention: "critical",
				summary: input.errorMessage ?? "Stripe webhook reconciliation failed.",
				payload: {
					stripeEventId: input.event.id,
				},
			},
		]
	}

	if (
		input.event.type.startsWith("refund.") ||
		input.event.type === "charge.refunded"
	) {
		const refundLike = input.event.data.object as Stripe.Refund & {
			failure_reason?: string | null
			status?: string | null
		}
		const isFailed =
			input.event.type === "refund.failed" ||
			refundLike.status === "failed" ||
			Boolean(refundLike.failure_reason)

		if (!isFailed) {
			return []
		}

		return [
			{
				organizationId: input.context.organizationId,
				branchId: input.context.branchId,
				topic: "billing_attention",
				eventType: input.event.type,
				entityType,
				entityId,
				attention: "critical",
				summary:
					refundLike.failure_reason ??
					"Stripe refund failed and needs attention.",
				payload: {
					stripeEventId: input.event.id,
					rentalId: input.context.rentalId,
				},
			},
		]
	}

	if (input.event.type.startsWith("payment_intent.")) {
		const intent = input.event.data.object as Stripe.PaymentIntent
		const status = normalizePaymentIntentStatus(intent.status)

		if (status === "requires_action") {
			return [
				{
					organizationId: input.context.organizationId,
					branchId: input.context.branchId,
					topic: "billing_attention",
					eventType: input.event.type,
					entityType,
					entityId,
					attention: "warning",
					summary: "Stripe payment requires customer or operator action.",
					payload: {
						stripeEventId: input.event.id,
						rentalId: input.context.rentalId,
					},
				},
			]
		}

		if (status === "failed" || status === "cancelled") {
			return [
				{
					organizationId: input.context.organizationId,
					branchId: input.context.branchId,
					topic: "billing_attention",
					eventType: input.event.type,
					entityType,
					entityId,
					attention: status === "failed" ? "critical" : "warning",
					summary:
						intent.last_payment_error?.message ??
						(status === "failed"
							? "Stripe payment failed."
							: "Stripe payment was cancelled."),
					payload: {
						stripeEventId: input.event.id,
						rentalId: input.context.rentalId,
					},
				},
			]
		}

		return []
	}

	if (input.event.type.startsWith("setup_intent.")) {
		const intent = input.event.data.object as Stripe.SetupIntent
		const status = normalizeSetupIntentStatus(intent.status)

		if (status === "requires_action") {
			return [
				{
					organizationId: input.context.organizationId,
					branchId: input.context.branchId,
					topic: "billing_attention",
					eventType: input.event.type,
					entityType,
					entityId,
					attention: "warning",
					summary: "Stored payment method setup requires customer action.",
					payload: {
						stripeEventId: input.event.id,
						rentalId: input.context.rentalId,
					},
				},
			]
		}

		if (status === "failed" || status === "cancelled") {
			return [
				{
					organizationId: input.context.organizationId,
					branchId: input.context.branchId,
					topic: "billing_attention",
					eventType: input.event.type,
					entityType,
					entityId,
					attention: status === "failed" ? "critical" : "warning",
					summary:
						intent.last_setup_error?.message ??
						(status === "failed"
							? "Stored payment method setup failed."
							: "Stored payment method setup was cancelled."),
					payload: {
						stripeEventId: input.event.id,
						rentalId: input.context.rentalId,
					},
				},
			]
		}

		return []
	}

	if (input.event.type.startsWith("invoice.")) {
		const invoice = input.event.data.object as Stripe.Invoice
		const status = normalizeInvoiceStatus(invoice.status)

		if (status === "open" || status === "uncollectible") {
			return [
				{
					organizationId: input.context.organizationId,
					branchId: input.context.branchId,
					topic: "billing_attention",
					eventType: input.event.type,
					entityType,
					entityId,
					attention: status === "uncollectible" ? "critical" : "warning",
					summary: buildInvoiceFailureReason(invoice),
					payload: {
						stripeEventId: input.event.id,
						rentalId: input.context.rentalId,
					},
				},
			]
		}

		if (status === "void" || status === "cancelled") {
			return [
				{
					organizationId: input.context.organizationId,
					branchId: input.context.branchId,
					topic: "billing_attention",
					eventType: input.event.type,
					entityType,
					entityId,
					attention: "warning",
					summary: buildInvoiceFailureReason(invoice),
					payload: {
						stripeEventId: input.event.id,
						rentalId: input.context.rentalId,
					},
				},
			]
		}

		return []
	}

	if (input.event.type.startsWith("customer.subscription.")) {
		const subscription = input.event.data.object as Stripe.Subscription
		const attention =
			subscription.status === "unpaid" || subscription.status === "past_due"
				? "critical"
				: subscription.status === "canceled" ||
						subscription.status === "paused" ||
						subscription.status === "incomplete"
					? "warning"
					: null

		if (!attention) {
			return []
		}

		return [
			{
				organizationId: input.context.organizationId,
				branchId: input.context.branchId,
				topic: "billing_attention",
				eventType: input.event.type,
				entityType,
				entityId,
				attention,
				summary: `Stripe subscription status changed to ${subscription.status.replaceAll("_", " ")}.`,
				payload: {
					stripeEventId: input.event.id,
					rentalId: input.context.rentalId,
				},
			},
		]
	}

	if (input.event.type.startsWith("subscription_schedule.")) {
		const schedule = input.event.data.object as Stripe.SubscriptionSchedule

		if (schedule.status !== "canceled" && schedule.status !== "released") {
			return []
		}

		return [
			{
				organizationId: input.context.organizationId,
				branchId: input.context.branchId,
				topic: "billing_attention",
				eventType: input.event.type,
				entityType,
				entityId,
				attention: "warning",
				summary:
					schedule.status === "released"
						? "Stripe released the recurring billing schedule."
						: "Stripe cancelled the recurring billing schedule.",
				payload: {
					stripeEventId: input.event.id,
					rentalId: input.context.rentalId,
				},
			},
		]
	}

	return []
}

function normalizePaymentIntentStatus(
	status: Stripe.PaymentIntent.Status,
): typeof rentalPayment.$inferSelect.status {
	switch (status) {
		case "succeeded":
			return "succeeded"
		case "processing":
			return "processing"
		case "requires_action":
		case "requires_confirmation":
		case "requires_payment_method":
			return "requires_action"
		case "canceled":
			return "cancelled"
		default:
			return "failed"
	}
}

function normalizeSetupIntentStatus(
	status: Stripe.SetupIntent.Status,
): typeof rentalPayment.$inferSelect.status {
	switch (status) {
		case "succeeded":
			return "succeeded"
		case "processing":
			return "processing"
		case "requires_action":
		case "requires_confirmation":
		case "requires_payment_method":
			return "requires_action"
		case "canceled":
			return "cancelled"
		default:
			return "failed"
	}
}

function normalizeInvoiceStatus(
	status: Stripe.Invoice.Status | null | undefined,
): typeof rentalInvoice.$inferSelect.status {
	switch (status) {
		case "draft":
			return "draft"
		case "open":
			return "open"
		case "paid":
			return "paid"
		case "void":
			return "void"
		case "uncollectible":
			return "uncollectible"
		default:
			return "cancelled"
	}
}

function _normalizeSubscriptionPaymentStatus(
	status: Stripe.Subscription.Status,
): typeof rentalPayment.$inferSelect.status {
	switch (status) {
		case "active":
		case "trialing":
			return "succeeded"
		case "incomplete":
		case "past_due":
		case "paused":
			return "requires_action"
		case "canceled":
			return "cancelled"
		case "unpaid":
		case "incomplete_expired":
			return "failed"
		default:
			return "pending"
	}
}

function normalizeRecurringBillingStateFromInvoiceStatus(
	status: Stripe.Invoice.Status | null | undefined,
): typeof rental.$inferSelect.recurringBillingState {
	switch (status) {
		case "paid":
			return "active_in_stripe"
		case "open":
		case "draft":
			return "scheduled_in_stripe"
		case "uncollectible":
			return "failed"
		case "void":
			return "cancelled"
		default:
			return "past_due"
	}
}

function normalizeRecurringBillingStateFromSubscriptionStatus(
	status: Stripe.Subscription.Status,
): typeof rental.$inferSelect.recurringBillingState {
	switch (status) {
		case "active":
		case "trialing":
			return "active_in_stripe"
		case "incomplete":
		case "paused":
			return "scheduled_in_stripe"
		case "past_due":
			return "past_due"
		case "canceled":
			return "cancelled"
		case "unpaid":
		case "incomplete_expired":
			return "failed"
		default:
			return "scheduled_in_stripe"
	}
}

function getInvoiceRecurringPeriod(input: Stripe.Invoice) {
	const recurringLine = input.lines.data.find(
		(line) =>
			line.period &&
			typeof line.period.start === "number" &&
			typeof line.period.end === "number" &&
			Math.abs(line.amount) > 0,
	)

	if (!recurringLine?.period) {
		return null
	}

	return {
		startAt: new Date(recurringLine.period.start * 1000),
		endAt: new Date(recurringLine.period.end * 1000),
	}
}

function buildInvoiceFailureReason(input: Stripe.Invoice) {
	if (input.status === "paid") {
		return null
	}

	if (input.status === "uncollectible") {
		return "Stripe marked the recurring invoice uncollectible."
	}

	if (input.status === "void") {
		return "Stripe voided the recurring invoice."
	}

	if (input.status === "open") {
		if (input.attempt_count > 1) {
			return `Stripe payment retry ${input.attempt_count} is still open.`
		}

		return "Stripe is awaiting payment for the recurring invoice."
	}

	return "Stripe reported a recurring invoice failure."
}

function getStripePaymentMethodId(
	object: Stripe.PaymentIntent | Stripe.SetupIntent,
) {
	return typeof object.payment_method === "string"
		? object.payment_method
		: (object.payment_method?.id ?? null)
}

function normalizeRefundStatus(
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

function getRefundReference(refund: Stripe.Refund) {
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

	return null
}

async function resolveWebhookContext(event: Stripe.Event) {
	const object = event.data.object as unknown as Record<string, unknown>
	const objectId = typeof object.id === "string" ? object.id : null

	const paymentPredicate =
		event.type.startsWith("payment_intent.") && objectId
			? eq(rentalPayment.stripePaymentIntentId, objectId)
			: event.type.startsWith("setup_intent.") && objectId
				? eq(rentalPayment.stripeSetupIntentId, objectId)
				: event.type.startsWith("refund.") && objectId
					? eq(rentalPaymentRefund.stripeRefundId, objectId)
					: event.type === "charge.refunded" && objectId
						? eq(rentalPayment.stripeChargeId, objectId)
						: event.type.startsWith("invoice.") && objectId
							? or(
									eq(rentalPayment.stripeInvoiceId, objectId),
									eq(rentalInvoice.stripeInvoiceId, objectId),
								)
							: event.type.startsWith("customer.subscription.") && objectId
								? eq(rentalPayment.stripeSubscriptionId, objectId)
								: event.type.startsWith("subscription_schedule.") && objectId
									? eq(rentalPayment.stripeSubscriptionScheduleId, objectId)
									: null

	if (!paymentPredicate) {
		return {
			organizationId: null,
			branchId: null,
			rentalId: null,
		} satisfies WebhookContext
	}

	if (event.type.startsWith("invoice.")) {
		const invoiceLike = event.data.object as Stripe.Invoice & {
			subscription?: string | Stripe.Subscription | null
		}
		const subscriptionId =
			typeof invoiceLike.subscription === "string"
				? invoiceLike.subscription
				: (invoiceLike.subscription?.id ?? null)

		const paymentRows = await db
			.select({
				organizationId: rentalPayment.organizationId,
				branchId: rentalPayment.branchId,
				rentalId: rentalPayment.rentalId,
			})
			.from(rentalPayment)
			.where(eq(rentalPayment.stripeInvoiceId, objectId ?? ""))
			.limit(1)

		if (paymentRows[0]) {
			return paymentRows[0]
		}

		if (subscriptionId) {
			const subscriptionRows = await db
				.select({
					organizationId: rentalPayment.organizationId,
					branchId: rentalPayment.branchId,
					rentalId: rentalPayment.rentalId,
				})
				.from(rentalPayment)
				.where(eq(rentalPayment.stripeSubscriptionId, subscriptionId))
				.limit(1)

			if (subscriptionRows[0]) {
				return subscriptionRows[0]
			}
		}

		const invoiceRows = await db
			.select({
				organizationId: rentalInvoice.organizationId,
				branchId: rentalInvoice.branchId,
				rentalId: rentalInvoice.rentalId,
			})
			.from(rentalInvoice)
			.where(eq(rentalInvoice.stripeInvoiceId, objectId ?? ""))
			.limit(1)

		return (
			invoiceRows[0] ?? {
				organizationId: null,
				branchId: null,
				rentalId: null,
			}
		)
	}

	if (event.type.startsWith("refund.")) {
		const rows = await db
			.select({
				organizationId: rentalPaymentRefund.organizationId,
				branchId: rentalPaymentRefund.branchId,
				rentalId: rentalPaymentRefund.rentalId,
			})
			.from(rentalPaymentRefund)
			.where(eq(rentalPaymentRefund.stripeRefundId, objectId ?? ""))
			.limit(1)

		return (
			rows[0] ?? {
				organizationId: null,
				branchId: null,
				rentalId: null,
			}
		)
	}

	const rows = await db
		.select({
			organizationId: rentalPayment.organizationId,
			branchId: rentalPayment.branchId,
			rentalId: rentalPayment.rentalId,
		})
		.from(rentalPayment)
		.where(paymentPredicate as ReturnType<typeof eq>)
		.limit(1)

	return (
		rows[0] ?? {
			organizationId: null,
			branchId: null,
			rentalId: null,
		}
	)
}

async function reconcileRefund(input: {
	tx: DbExecutor
	refund: Stripe.Refund
}) {
	const status = normalizeRefundStatus(input.refund.status)
	const now = new Date()
	const matchedRefundRows = await input.tx
		.select()
		.from(rentalPaymentRefund)
		.where(eq(rentalPaymentRefund.stripeRefundId, input.refund.id))

	for (const refundRow of matchedRefundRows) {
		await input.tx
			.update(rentalPaymentRefund)
			.set({
				status,
				reference: getRefundReference(input.refund),
				failureReason: input.refund.failure_reason ?? null,
				updatedAt: now,
			})
			.where(eq(rentalPaymentRefund.id, refundRow.id))

		if (status === "succeeded") {
			await input.tx
				.update(rentalPayment)
				.set({
					status: "refunded",
					refundedAt: now,
					updatedAt: now,
				})
				.where(eq(rentalPayment.id, refundRow.paymentId))
		}
	}
}

async function reconcileChargeRefunded(input: {
	tx: DbExecutor
	charge: Stripe.Charge
}) {
	if (
		input.charge.amount <= 0 ||
		input.charge.amount_refunded < input.charge.amount
	) {
		return
	}

	const now = new Date()
	const matchedPayments = await input.tx
		.select()
		.from(rentalPayment)
		.where(eq(rentalPayment.stripeChargeId, input.charge.id))

	for (const payment of matchedPayments) {
		await input.tx
			.update(rentalPayment)
			.set({
				status: "refunded",
				refundedAt: now,
				updatedAt: now,
			})
			.where(eq(rentalPayment.id, payment.id))

		await input.tx
			.update(rentalPaymentRefund)
			.set({
				status: "succeeded",
				updatedAt: now,
			})
			.where(eq(rentalPaymentRefund.paymentId, payment.id))
	}
}

async function reconcileRecurringScheduleRowForInvoice(input: {
	tx: DbExecutor
	organizationId: string
	rentalId: string
	invoice: Stripe.Invoice
	subscriptionId: string
	paymentIntentId: string | null
	now: Date
}) {
	const invoiceTotal =
		typeof input.invoice.total === "number" ? input.invoice.total / 100 : 0
	const recurringPeriod = getInvoiceRecurringPeriod(input.invoice)
	const status =
		input.invoice.status === "paid"
			? "succeeded"
			: input.invoice.status === "open"
				? "processing"
				: input.invoice.status === "void"
					? "cancelled"
					: "failed"

	const existingScheduleRow = await input.tx
		.select()
		.from(rentalPaymentSchedule)
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, input.organizationId),
				eq(rentalPaymentSchedule.rentalId, input.rentalId),
				eq(rentalPaymentSchedule.stripeInvoiceId, input.invoice.id),
			),
		)
		.limit(1)
		.then((rows) => rows[0] ?? null)

	const targetScheduleRow =
		existingScheduleRow ??
		(await input.tx
			.select()
			.from(rentalPaymentSchedule)
			.where(
				and(
					eq(rentalPaymentSchedule.organizationId, input.organizationId),
					eq(rentalPaymentSchedule.rentalId, input.rentalId),
					eq(rentalPaymentSchedule.isFirstCharge, false),
					inArray(rentalPaymentSchedule.status, [
						"pending",
						"processing",
						"failed",
					]),
				),
			)
			.orderBy(asc(rentalPaymentSchedule.sequence))
			.then((rows) => {
				if (recurringPeriod) {
					const exactDueMatch = rows.find(
						(row) => row.dueAt.getTime() === recurringPeriod.startAt.getTime(),
					)

					if (exactDueMatch) {
						return exactDueMatch
					}

					const boundedMatch = rows.find(
						(row) =>
							row.dueAt.getTime() >= recurringPeriod.startAt.getTime() &&
							row.dueAt.getTime() < recurringPeriod.endAt.getTime(),
					)

					if (boundedMatch) {
						return boundedMatch
					}
				}

				const exactAmountMatch = rows.find(
					(row) => Number(row.amount) === invoiceTotal,
				)
				return exactAmountMatch ?? rows[0] ?? null
			}))

	if (!targetScheduleRow) {
		return
	}

	await input.tx
		.update(rentalPaymentSchedule)
		.set({
			stripeInvoiceId: input.invoice.id,
			stripeSubscriptionId: input.subscriptionId,
			status,
			settledAt: input.invoice.status === "paid" ? input.now : null,
			failureReason: buildInvoiceFailureReason(input.invoice),
			metadata: {
				...(targetScheduleRow.metadata ?? {}),
				stripeRecurring: {
					invoiceId: input.invoice.id,
					subscriptionId: input.subscriptionId,
					periodStartAt: recurringPeriod?.startAt.toISOString() ?? null,
					periodEndAt: recurringPeriod?.endAt.toISOString() ?? null,
					attemptCount: input.invoice.attempt_count ?? null,
					nextPaymentAttemptAt: input.invoice.next_payment_attempt
						? new Date(input.invoice.next_payment_attempt * 1000).toISOString()
						: null,
					hostedInvoiceUrl: input.invoice.hosted_invoice_url ?? null,
					status: input.invoice.status ?? null,
				},
			},
			updatedAt: input.now,
		})
		.where(eq(rentalPaymentSchedule.id, targetScheduleRow.id))

	const existingPayment = await input.tx
		.select({ id: rentalPayment.id })
		.from(rentalPayment)
		.where(
			and(
				eq(rentalPayment.organizationId, input.organizationId),
				eq(rentalPayment.rentalId, input.rentalId),
				eq(rentalPayment.scheduleId, targetScheduleRow.id),
				eq(rentalPayment.stripeInvoiceId, input.invoice.id),
			),
		)
		.limit(1)

	if (existingPayment[0]) {
		await input.tx
			.update(rentalPayment)
			.set({
				status:
					input.invoice.status === "paid"
						? "succeeded"
						: input.invoice.status === "open"
							? "processing"
							: input.invoice.status === "void"
								? "cancelled"
								: "failed",
				stripePaymentIntentId: input.paymentIntentId,
				stripeSubscriptionId: input.subscriptionId,
				metadata: {
					...(targetScheduleRow.metadata ?? {}),
					stripeRecurringInvoiceId: input.invoice.id,
				},
				updatedAt: input.now,
			})
			.where(eq(rentalPayment.id, existingPayment[0].id))
		return
	}

	await input.tx.insert(rentalPayment).values({
		organizationId: input.organizationId,
		branchId: targetScheduleRow.branchId,
		rentalId: input.rentalId,
		scheduleId: targetScheduleRow.id,
		kind: "schedule_collection",
		status:
			input.invoice.status === "paid"
				? "succeeded"
				: input.invoice.status === "open"
					? "processing"
					: input.invoice.status === "void"
						? "cancelled"
						: "failed",
		provider: "stripe",
		paymentMethodType: targetScheduleRow.paymentMethodType,
		collectionSurface:
			targetScheduleRow.paymentMethodType === "card"
				? "terminal_reader"
				: targetScheduleRow.paymentMethodType === "au_becs_debit"
					? "direct_debit"
					: null,
		amount: targetScheduleRow.amount,
		currency: targetScheduleRow.currency,
		stripeInvoiceId: input.invoice.id,
		stripePaymentIntentId: input.paymentIntentId,
		stripeSubscriptionId: input.subscriptionId,
		capturedAt: input.invoice.status === "paid" ? input.now : null,
	})
}

async function reconcileRentalLifecycle(input: {
	tx: DbExecutor
	organizationId: string
	rentalId: string
}) {
	const record = await input.tx
		.select({
			id: rental.id,
			status: rental.status,
			actualStartAt: rental.actualStartAt,
		})
		.from(rental)
		.where(
			and(
				eq(rental.organizationId, input.organizationId),
				eq(rental.id, input.rentalId),
			),
		)
		.limit(1)
		.then((rows) => rows[0] ?? null)

	if (!record) {
		return
	}

	if (
		record.status === "draft" ||
		record.status === "completed" ||
		record.status === "cancelled" ||
		record.status === "cancelling" ||
		record.status === "active"
	) {
		return
	}

	const now = new Date()
	const outstandingDueRows = await input.tx
		.select({ id: rentalPaymentSchedule.id })
		.from(rentalPaymentSchedule)
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, input.organizationId),
				eq(rentalPaymentSchedule.rentalId, input.rentalId),
				inArray(rentalPaymentSchedule.status, [
					"pending",
					"processing",
					"failed",
				]),
				sql`${rentalPaymentSchedule.dueAt} <= ${now}`,
			),
		)
		.limit(1)

	const nextStatus =
		outstandingDueRows.length > 0
			? "awaiting_payment"
			: record.status === "awaiting_payment"
				? record.actualStartAt
					? "active"
					: "scheduled"
				: record.status

	if (nextStatus !== record.status) {
		await input.tx
			.update(rental)
			.set({
				status: nextStatus,
				updatedAt: now,
			})
			.where(
				and(
					eq(rental.organizationId, input.organizationId),
					eq(rental.id, input.rentalId),
				),
			)
	}
}

async function reconcilePaymentIntent(input: {
	tx: DbExecutor
	intent: Stripe.PaymentIntent
	context: WebhookContext
}) {
	const status = normalizePaymentIntentStatus(input.intent.status)
	const paymentMethodId = getStripePaymentMethodId(input.intent)
	const rows = await input.tx
		.select()
		.from(rentalPayment)
		.where(eq(rentalPayment.stripePaymentIntentId, input.intent.id))

	if (rows.length === 0) {
		return
	}

	const now = new Date()
	await input.tx
		.update(rentalPayment)
		.set({
			status,
			stripePaymentMethodId: paymentMethodId,
			capturedAt: status === "succeeded" ? now : null,
			updatedAt: now,
		})
		.where(eq(rentalPayment.stripePaymentIntentId, input.intent.id))

	for (const row of rows) {
		if (row.scheduleId) {
			await input.tx
				.update(rentalPaymentSchedule)
				.set({
					status:
						status === "succeeded"
							? "succeeded"
							: status === "processing"
								? "processing"
								: status === "failed" || status === "cancelled"
									? "failed"
									: "pending",
					paymentMethodType: row.paymentMethodType,
					settledAt: status === "succeeded" ? now : null,
					updatedAt: now,
				})
				.where(eq(rentalPaymentSchedule.id, row.scheduleId))
		}

		if (
			paymentMethodId &&
			row.kind === "schedule_collection" &&
			row.paymentMethodType !== "cash"
		) {
			await input.tx
				.update(rental)
				.set({
					storedPaymentMethodStatus: "ready",
					updatedAt: now,
				})
				.where(
					and(
						eq(rental.organizationId, row.organizationId),
						eq(rental.id, row.rentalId),
					),
				)
		}
	}
}

async function reconcileSetupIntent(input: {
	tx: DbExecutor
	intent: Stripe.SetupIntent
}) {
	const status = normalizeSetupIntentStatus(input.intent.status)
	const paymentMethodId = getStripePaymentMethodId(input.intent)
	const rows = await input.tx
		.select()
		.from(rentalPayment)
		.where(eq(rentalPayment.stripeSetupIntentId, input.intent.id))

	if (rows.length === 0) {
		return
	}

	const now = new Date()
	await input.tx
		.update(rentalPayment)
		.set({
			status,
			stripePaymentMethodId: paymentMethodId,
			capturedAt: status === "succeeded" ? now : null,
			updatedAt: now,
		})
		.where(eq(rentalPayment.stripeSetupIntentId, input.intent.id))

	for (const row of rows) {
		await input.tx
			.update(rental)
			.set({
				storedPaymentMethodStatus:
					status === "succeeded"
						? "ready"
						: status === "processing"
							? "pending"
							: "failed",
				updatedAt: now,
			})
			.where(
				and(
					eq(rental.organizationId, row.organizationId),
					eq(rental.id, row.rentalId),
				),
			)
	}
}

async function reconcileInvoice(input: {
	tx: DbExecutor
	invoice: Stripe.Invoice
}) {
	const invoiceId = input.invoice.id
	const invoiceLike = input.invoice as Stripe.Invoice & {
		payment_intent?: string | Stripe.PaymentIntent | null
		subscription?: string | Stripe.Subscription | null
	}
	const paymentIntentId =
		typeof invoiceLike.payment_intent === "string"
			? invoiceLike.payment_intent
			: (invoiceLike.payment_intent?.id ?? null)
	const subscriptionId =
		typeof invoiceLike.subscription === "string"
			? invoiceLike.subscription
			: (invoiceLike.subscription?.id ?? null)
	const status = normalizeInvoiceStatus(input.invoice.status)
	const now = new Date()

	await input.tx
		.update(rentalInvoice)
		.set({
			status,
			stripeInvoiceId: invoiceId,
			hostedInvoiceUrl: input.invoice.hosted_invoice_url ?? null,
			invoicePdfUrl: input.invoice.invoice_pdf ?? null,
			issuedAt: input.invoice.status_transitions.finalized_at
				? new Date(input.invoice.status_transitions.finalized_at * 1000)
				: null,
			updatedAt: now,
		})
		.where(eq(rentalInvoice.stripeInvoiceId, invoiceId))

	await input.tx
		.update(rentalPayment)
		.set({
			status:
				status === "paid"
					? "succeeded"
					: status === "open"
						? "pending"
						: status === "void" || status === "cancelled"
							? "cancelled"
							: "failed",
			stripeInvoiceId: invoiceId,
			stripePaymentIntentId: paymentIntentId,
			stripeSubscriptionId: subscriptionId,
			updatedAt: now,
		})
		.where(eq(rentalPayment.stripeInvoiceId, invoiceId))

	if (subscriptionId) {
		const relatedRentals = await input.tx
			.selectDistinct({
				organizationId: rentalPayment.organizationId,
				rentalId: rentalPayment.rentalId,
			})
			.from(rentalPayment)
			.where(eq(rentalPayment.stripeSubscriptionId, subscriptionId))

		for (const related of relatedRentals) {
			await reconcileRecurringScheduleRowForInvoice({
				tx: input.tx,
				organizationId: related.organizationId,
				rentalId: related.rentalId,
				invoice: input.invoice,
				subscriptionId,
				paymentIntentId,
				now,
			})

			await input.tx
				.update(rental)
				.set({
					recurringBillingState:
						normalizeRecurringBillingStateFromInvoiceStatus(
							input.invoice.status,
						),
					updatedAt: now,
				})
				.where(
					and(
						eq(rental.organizationId, related.organizationId),
						eq(rental.id, related.rentalId),
					),
				)
		}
	}
}

async function reconcileSubscription(input: {
	tx: DbExecutor
	subscription: Stripe.Subscription
}) {
	const subscriptionId = input.subscription.id
	const now = new Date()

	const relatedRentals = await input.tx
		.selectDistinct({
			organizationId: rentalPayment.organizationId,
			rentalId: rentalPayment.rentalId,
		})
		.from(rentalPayment)
		.where(eq(rentalPayment.stripeSubscriptionId, subscriptionId))

	for (const related of relatedRentals) {
		if (input.subscription.status === "canceled") {
			await input.tx
				.update(rentalPaymentSchedule)
				.set({
					status: "cancelled",
					failureReason: "Stripe cancelled the recurring subscription.",
					updatedAt: now,
				})
				.where(
					and(
						eq(rentalPaymentSchedule.organizationId, related.organizationId),
						eq(rentalPaymentSchedule.rentalId, related.rentalId),
						eq(rentalPaymentSchedule.stripeSubscriptionId, subscriptionId),
						inArray(rentalPaymentSchedule.status, [
							"pending",
							"processing",
							"failed",
						]),
					),
				)
		}

		await input.tx
			.update(rental)
			.set({
				recurringBillingState:
					normalizeRecurringBillingStateFromSubscriptionStatus(
						input.subscription.status,
					),
				updatedAt: now,
			})
			.where(
				and(
					eq(rental.organizationId, related.organizationId),
					eq(rental.id, related.rentalId),
				),
			)
	}
}

async function reconcileSubscriptionSchedule(input: {
	tx: DbExecutor
	schedule: Stripe.SubscriptionSchedule
}) {
	const scheduleId = input.schedule.id
	const now = new Date()
	const relatedRentals = await input.tx
		.selectDistinct({
			organizationId: rentalPayment.organizationId,
			rentalId: rentalPayment.rentalId,
		})
		.from(rentalPayment)
		.where(eq(rentalPayment.stripeSubscriptionScheduleId, scheduleId))

	if (relatedRentals.length === 0) {
		return
	}

	const isCancelled =
		input.schedule.status === "canceled" || input.schedule.status === "released"

	for (const related of relatedRentals) {
		if (isCancelled) {
			await input.tx
				.update(rentalPaymentSchedule)
				.set({
					status: "cancelled",
					failureReason:
						input.schedule.status === "released"
							? "Stripe released the recurring billing schedule."
							: "Stripe cancelled the recurring billing schedule.",
					updatedAt: now,
				})
				.where(
					and(
						eq(rentalPaymentSchedule.organizationId, related.organizationId),
						eq(rentalPaymentSchedule.rentalId, related.rentalId),
						inArray(rentalPaymentSchedule.status, [
							"pending",
							"processing",
							"failed",
						]),
					),
				)

			await input.tx
				.update(rentalPayment)
				.set({
					stripeSubscriptionScheduleId: null,
					updatedAt: now,
				})
				.where(
					and(
						eq(rentalPayment.organizationId, related.organizationId),
						eq(rentalPayment.rentalId, related.rentalId),
						eq(rentalPayment.stripeSubscriptionScheduleId, scheduleId),
					),
				)
		}

		await input.tx
			.update(rental)
			.set({
				recurringBillingState: isCancelled
					? "cancelled"
					: "scheduled_in_stripe",
				updatedAt: now,
			})
			.where(
				and(
					eq(rental.organizationId, related.organizationId),
					eq(rental.id, related.rentalId),
				),
			)
	}
}

export async function POST(request: Request) {
	const signingSecret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET?.trim()
	if (!signingSecret) {
		return jsonError("STRIPE_WEBHOOK_SIGNING_SECRET is not configured.", 503)
	}

	const signature = request.headers.get("stripe-signature")?.trim()
	if (!signature) {
		return jsonError("Missing Stripe signature header.", 400)
	}

	const payload = await request.text()
	const payloadJson = JSON.parse(payload) as Record<string, unknown>
	const stripe = requireStripeServer()

	let event: Stripe.Event

	try {
		event = stripe.webhooks.constructEvent(payload, signature, signingSecret)
	} catch {
		return jsonError("Invalid Stripe webhook signature.", 400)
	}

	const eventObjectRecord = event.data.object as unknown as {
		id?: string
		object: string
	}
	const context = await resolveWebhookContext(event)

	const result = await db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${event.id}))`)

		const existing = await tx
			.select({ id: stripeWebhookEvent.id })
			.from(stripeWebhookEvent)
			.where(eq(stripeWebhookEvent.stripeEventId, event.id))
			.limit(1)

		if (existing[0]) {
			return { duplicate: true }
		}

		let status: typeof stripeWebhookEvent.$inferSelect.status = "processed"
		let errorMessage: string | null = null

		try {
			if (event.type.startsWith("payment_intent.")) {
				await reconcilePaymentIntent({
					tx,
					intent: event.data.object as Stripe.PaymentIntent,
					context,
				})
			} else if (event.type.startsWith("setup_intent.")) {
				await reconcileSetupIntent({
					tx,
					intent: event.data.object as Stripe.SetupIntent,
				})
			} else if (event.type.startsWith("refund.")) {
				await reconcileRefund({
					tx,
					refund: event.data.object as Stripe.Refund,
				})
			} else if (event.type === "charge.refunded") {
				await reconcileChargeRefunded({
					tx,
					charge: event.data.object as Stripe.Charge,
				})
			} else if (event.type.startsWith("invoice.")) {
				await reconcileInvoice({
					tx,
					invoice: event.data.object as Stripe.Invoice,
				})
			} else if (event.type.startsWith("customer.subscription.")) {
				await reconcileSubscription({
					tx,
					subscription: event.data.object as Stripe.Subscription,
				})
			} else if (event.type.startsWith("subscription_schedule.")) {
				await reconcileSubscriptionSchedule({
					tx,
					schedule: event.data.object as Stripe.SubscriptionSchedule,
				})
			} else {
				status = "ignored"
			}

			if (context.organizationId && context.rentalId) {
				await reconcileRentalLifecycle({
					tx,
					organizationId: context.organizationId,
					rentalId: context.rentalId,
				})
			}
		} catch (error) {
			status = "failed"
			errorMessage =
				error instanceof Error
					? error.message
					: "Stripe webhook reconciliation failed."
		}

		await tx.insert(stripeWebhookEvent).values({
			organizationId: context.organizationId,
			branchId: context.branchId,
			stripeEventId: event.id,
			type: event.type,
			mode: event.livemode ? "live" : "test",
			apiVersion: event.api_version ?? null,
			accountId: event.account ?? null,
			objectType: eventObjectRecord.object,
			objectId:
				typeof eventObjectRecord.id === "string" ? eventObjectRecord.id : null,
			status,
			errorMessage,
			payloadJson,
			processedAt: new Date(),
		})

		const billingAttentionEvents = buildBillingAttentionRealtimeEvents({
			event,
			context,
			status,
			errorMessage,
		})
		await publishWorkspaceRealtimeEvents(
			tx as unknown as typeof db,
			billingAttentionEvents,
		)

		return { duplicate: false, status }
	})

	if (result.duplicate) {
		return NextResponse.json({ received: true, duplicate: true })
	}

	if (
		result.status === "processed" &&
		context.organizationId &&
		context.rentalId
	) {
		try {
			await continueCancellingRental({
				organizationId: context.organizationId,
				rentalId: context.rentalId,
			})
		} catch {}
	}

	return NextResponse.json({ received: true, status: result.status })
}
