import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import {
	rental,
	rentalPayment,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import { ensureStripeCustomerForRentalCustomer } from "./rentals"
import { createRentalRecurringBillingSchedule } from "./rentals-recurring"
import { requireStripeServer } from "./server"

type RentalRecord = typeof rental.$inferSelect
type RentalPaymentRecord = typeof rentalPayment.$inferSelect
type RentalScheduleRow = typeof rentalPaymentSchedule.$inferSelect

type RentalCustomerStripeInput = Parameters<
	typeof ensureStripeCustomerForRentalCustomer
>[0]

export function getRentalBillingSelectionState(input: {
	paymentMethodType: RentalRecord["selectedPaymentMethodType"]
	paymentPlanKind: RentalRecord["paymentPlanKind"]
}) {
	if (input.paymentMethodType === "cash") {
		return {
			storedPaymentMethodStatus: "none" as const,
			recurringBillingState: "none" as const,
		}
	}

	return {
		storedPaymentMethodStatus: "pending" as const,
		recurringBillingState:
			input.paymentPlanKind === "installment"
				? ("pending_setup" as const)
				: ("none" as const),
	}
}

export function getRentalStoredMethodStateFromStripeConfirmation(input: {
	paymentPlanKind: RentalRecord["paymentPlanKind"]
	paymentMethodType: RentalPaymentRecord["paymentMethodType"]
	paymentAttemptKind: RentalPaymentRecord["kind"]
	status: RentalPaymentRecord["status"]
	resolvedStripePaymentMethodId: string | null
	currentRecurringBillingState: RentalRecord["recurringBillingState"]
}) {
	if (
		input.paymentAttemptKind !== "payment_method_setup" &&
		!(
			input.paymentAttemptKind === "schedule_collection" &&
			input.paymentPlanKind === "installment" &&
			input.paymentMethodType !== "cash"
		)
	) {
		return null
	}

	const nextStoredPaymentMethodStatus =
		input.resolvedStripePaymentMethodId &&
		input.paymentAttemptKind === "schedule_collection" &&
		input.paymentPlanKind === "installment" &&
		input.paymentMethodType !== "cash"
			? "ready"
			: input.status === "succeeded"
				? "ready"
				: input.status === "processing"
					? "pending"
					: "failed"

	return {
		storedPaymentMethodStatus:
			nextStoredPaymentMethodStatus as RentalRecord["storedPaymentMethodStatus"],
		recurringBillingState:
			input.paymentPlanKind === "installment" &&
			input.paymentMethodType !== "cash"
				? nextStoredPaymentMethodStatus === "ready"
					? ("ready_to_schedule" as const)
					: nextStoredPaymentMethodStatus === "pending"
						? ("pending_setup" as const)
						: ("failed" as const)
				: input.currentRecurringBillingState,
	}
}

export function resolveRecurringPaymentMethodId(input: {
	paymentRows: RentalPaymentRecord[]
}) {
	return (
		input.paymentRows.find(
			(payment) =>
				payment.kind === "payment_method_setup" &&
				typeof payment.stripePaymentMethodId === "string" &&
				payment.stripePaymentMethodId.length > 0,
		)?.stripePaymentMethodId ??
		input.paymentRows.find(
			(payment) =>
				payment.kind === "schedule_collection" &&
				typeof payment.stripePaymentMethodId === "string" &&
				payment.stripePaymentMethodId.length > 0,
		)?.stripePaymentMethodId ??
		null
	)
}

export async function upsertRentalPaymentAttempt(input: {
	organizationId: string
	branchId: string | null
	rentalId: string
	scheduleId?: string | null
	kind: RentalPaymentRecord["kind"]
	status: RentalPaymentRecord["status"]
	provider: string
	paymentMethodType: RentalPaymentRecord["paymentMethodType"]
	collectionSurface: RentalPaymentRecord["collectionSurface"]
	amount: number
	currency: string
	idempotencyKey: string
	stripePaymentIntentId?: string | null
	stripeSetupIntentId?: string | null
	stripePaymentMethodId?: string | null
	metadata?: Record<string, unknown>
}) {
	const existingRows = await db
		.select({ id: rentalPayment.id })
		.from(rentalPayment)
		.where(
			and(
				eq(rentalPayment.organizationId, input.organizationId),
				eq(rentalPayment.idempotencyKey, input.idempotencyKey),
			),
		)
		.limit(1)

	if (existingRows[0]) {
		const [updated] = await db
			.update(rentalPayment)
			.set({
				scheduleId: input.scheduleId ?? null,
				kind: input.kind,
				status: input.status,
				provider: input.provider,
				paymentMethodType: input.paymentMethodType,
				collectionSurface: input.collectionSurface,
				amount: input.amount.toFixed(2),
				currency: input.currency,
				stripePaymentIntentId: input.stripePaymentIntentId ?? null,
				stripeSetupIntentId: input.stripeSetupIntentId ?? null,
				stripePaymentMethodId: input.stripePaymentMethodId ?? null,
				metadata: input.metadata ?? {},
				updatedAt: new Date(),
			})
			.where(eq(rentalPayment.id, existingRows[0].id))
			.returning()

		return updated
	}

	const [created] = await db
		.insert(rentalPayment)
		.values({
			organizationId: input.organizationId,
			branchId: input.branchId,
			rentalId: input.rentalId,
			scheduleId: input.scheduleId ?? null,
			kind: input.kind,
			status: input.status,
			provider: input.provider,
			paymentMethodType: input.paymentMethodType,
			collectionSurface: input.collectionSurface,
			amount: input.amount.toFixed(2),
			currency: input.currency,
			idempotencyKey: input.idempotencyKey,
			stripePaymentIntentId: input.stripePaymentIntentId ?? null,
			stripeSetupIntentId: input.stripeSetupIntentId ?? null,
			stripePaymentMethodId: input.stripePaymentMethodId ?? null,
			metadata: input.metadata ?? {},
		})
		.returning()

	return created
}

export async function ensureRecurringBillingForRental(input: {
	organizationId: string
	rentalId: string
	customer: RentalCustomerStripeInput
	currency: string
	installmentInterval: NonNullable<RentalRecord["installmentInterval"]>
	paymentRows: RentalPaymentRecord[]
	scheduleRows: RentalScheduleRow[]
}) {
	const existingRecurringRow = input.paymentRows.find(
		(payment) => payment.stripeSubscriptionScheduleId,
	)

	if (existingRecurringRow?.stripeSubscriptionScheduleId) {
		return {
			recurringBillingState: "scheduled_in_stripe" as const,
			scheduleId: existingRecurringRow.stripeSubscriptionScheduleId,
			subscriptionId: existingRecurringRow.stripeSubscriptionId,
			created: false,
		}
	}

	const paymentMethodId = resolveRecurringPaymentMethodId({
		paymentRows: input.paymentRows,
	})
	const futureRows = input.scheduleRows.filter((row) => !row.isFirstCharge)

	if (!paymentMethodId || futureRows.length === 0) {
		return {
			recurringBillingState: "ready_to_schedule" as const,
			scheduleId: null,
			subscriptionId: null,
			created: false,
		}
	}

	const stripeCustomerId = await ensureStripeCustomerForRentalCustomer(
		input.customer,
	)
	const recurringSchedule = await createRentalRecurringBillingSchedule({
		organizationId: input.organizationId,
		rentalId: input.rentalId,
		stripeCustomerId,
		paymentMethodId,
		currency: input.currency,
		installmentInterval: input.installmentInterval,
		scheduleRows: futureRows.map((row) => ({
			amount: Number(row.amount),
			dueAt: row.dueAt,
		})),
	})

	await db
		.update(rentalPayment)
		.set({
			stripeSubscriptionScheduleId: recurringSchedule.scheduleId,
			stripeSubscriptionId: recurringSchedule.subscriptionId,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rentalPayment.organizationId, input.organizationId),
				eq(rentalPayment.rentalId, input.rentalId),
				inArray(rentalPayment.kind, [
					"payment_method_setup",
					"schedule_collection",
				]),
			),
		)

	if (recurringSchedule.subscriptionId) {
		await db
			.update(rentalPaymentSchedule)
			.set({
				stripeSubscriptionId: recurringSchedule.subscriptionId,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(rentalPaymentSchedule.organizationId, input.organizationId),
					eq(rentalPaymentSchedule.rentalId, input.rentalId),
					eq(rentalPaymentSchedule.isFirstCharge, false),
				),
			)
	}

	return {
		recurringBillingState: "scheduled_in_stripe" as const,
		scheduleId: recurringSchedule.scheduleId,
		subscriptionId: recurringSchedule.subscriptionId,
		created: true,
	}
}

export async function cancelPreActivationRecurringBilling(input: {
	organizationId: string
	rentalId: string
	nextRecurringBillingState?: RentalRecord["recurringBillingState"]
}) {
	const existingPaymentRows = await db
		.select({
			id: rentalPayment.id,
			status: rentalPayment.status,
			scheduleId: rentalPayment.scheduleId,
			stripePaymentIntentId: rentalPayment.stripePaymentIntentId,
			stripeSetupIntentId: rentalPayment.stripeSetupIntentId,
			stripeSubscriptionScheduleId: rentalPayment.stripeSubscriptionScheduleId,
			stripeSubscriptionId: rentalPayment.stripeSubscriptionId,
		})
		.from(rentalPayment)
		.where(
			and(
				eq(rentalPayment.organizationId, input.organizationId),
				eq(rentalPayment.rentalId, input.rentalId),
			),
		)
	const existingRecurringRow =
		existingPaymentRows.find((row) => row.stripeSubscriptionScheduleId) ?? null

	const stripe =
		existingRecurringRow?.stripeSubscriptionScheduleId ||
		existingPaymentRows.some(
			(row) =>
				row.stripePaymentIntentId !== null || row.stripeSetupIntentId !== null,
		)
			? requireStripeServer()
			: null

	if (stripe && existingRecurringRow?.stripeSubscriptionScheduleId) {
		await stripe.subscriptionSchedules.cancel(
			existingRecurringRow.stripeSubscriptionScheduleId,
		)
	}

	if (stripe) {
		for (const paymentRow of existingPaymentRows) {
			if (
				paymentRow.stripePaymentIntentId &&
				paymentRow.status !== "succeeded" &&
				paymentRow.status !== "refunded" &&
				paymentRow.status !== "cancelled"
			) {
				await stripe.paymentIntents.cancel(paymentRow.stripePaymentIntentId)
			}

			if (
				paymentRow.stripeSetupIntentId &&
				paymentRow.status !== "succeeded" &&
				paymentRow.status !== "cancelled"
			) {
				await stripe.setupIntents.cancel(paymentRow.stripeSetupIntentId)
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
			recurringBillingState:
				input.nextRecurringBillingState ?? "ready_to_schedule",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rental.organizationId, input.organizationId),
				eq(rental.id, input.rentalId),
			),
		)
}
