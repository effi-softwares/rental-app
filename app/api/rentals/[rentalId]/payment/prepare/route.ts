import { createHash } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import {
	rental,
	type rentalPayment,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import {
	getRentalBillingSelectionState,
	upsertRentalPaymentAttempt,
} from "@/lib/stripe/rental-billing"
import { ensureStripeCustomerForRentalCustomer } from "@/lib/stripe/rentals"
import { requireStripeServer } from "@/lib/stripe/server"
import {
	getCustomerForFinalize,
	getLatestPendingSchedule,
	getScopedRentalForViewer,
	hasReachableCustomerContact,
	logRentalEvent,
	mapRentalPaymentRecord,
	numericToNumber,
} from "../../../_lib"

type RouteProps = {
	params: Promise<{
		rentalId: string
	}>
}

function toStripeAmount(amount: number) {
	return Math.max(0, Math.round(amount * 100))
}

export async function POST(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "managePaymentsModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const { rentalId } = await params
	const scopedRental = await getScopedRentalForViewer(viewer, rentalId)

	if ("error" in scopedRental) {
		return scopedRental.error
	}

	const payload = (await request.json().catch(() => null)) as {
		paymentMethodType?: "cash" | "card" | "au_becs_debit"
		scheduleId?: string
	} | null

	const paymentMethodType = payload?.paymentMethodType
	if (
		paymentMethodType !== "cash" &&
		paymentMethodType !== "card" &&
		paymentMethodType !== "au_becs_debit"
	) {
		return jsonError("A valid payment method is required.", 400)
	}

	if (!scopedRental.record.customerId) {
		return jsonError("Assign a customer before preparing payment.", 400)
	}

	const [customerRecord, branchRecord] = await Promise.all([
		getCustomerForFinalize(
			viewer.activeOrganizationId,
			scopedRental.record.customerId,
		),
		scopedRental.record.branchId
			? db
					.select({
						id: branch.id,
						stripeTerminalLocationId: branch.stripeTerminalLocationId,
					})
					.from(branch)
					.where(
						and(
							eq(branch.organizationId, viewer.activeOrganizationId),
							eq(branch.id, scopedRental.record.branchId),
						),
					)
					.limit(1)
					.then((rows) => rows[0] ?? null)
			: Promise.resolve(null),
	])

	if (!customerRecord || !hasReachableCustomerContact(customerRecord)) {
		return jsonError(
			"Customer must have at least one email or phone before payment setup.",
			400,
		)
	}

	const selectedScheduleId = payload?.scheduleId ?? undefined
	const targetSchedule = selectedScheduleId
		? await db
				.select()
				.from(rentalPaymentSchedule)
				.where(
					and(
						eq(
							rentalPaymentSchedule.organizationId,
							viewer.activeOrganizationId,
						),
						eq(rentalPaymentSchedule.rentalId, scopedRental.record.id),
						eq(rentalPaymentSchedule.id, selectedScheduleId),
					),
				)
				.limit(1)
				.then((rows) => rows[0] ?? null)
		: await getLatestPendingSchedule(
				viewer.activeOrganizationId,
				scopedRental.record.id,
			)

	if (!targetSchedule) {
		return jsonError("No pending payment schedule row is available.", 400)
	}

	const keyPrefix = createHash("sha256")
		.update(
			JSON.stringify({
				rentalId: scopedRental.record.id,
				scheduleId: targetSchedule.id,
				paymentMethodType,
				paymentPlanKind: scopedRental.record.paymentPlanKind,
				firstCollectionTiming: scopedRental.record.firstCollectionTiming,
			}),
		)
		.digest("hex")

	await db
		.update(rental)
		.set({
			selectedPaymentMethodType: paymentMethodType,
			...getRentalBillingSelectionState({
				paymentMethodType,
				paymentPlanKind: scopedRental.record.paymentPlanKind,
			}),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rental.organizationId, viewer.activeOrganizationId),
				eq(rental.id, scopedRental.record.id),
			),
		)

	if (paymentMethodType === "cash") {
		await logRentalEvent({
			viewer,
			rentalId: scopedRental.record.id,
			branchId: scopedRental.record.branchId,
			type: "rental.payment.cash_selected",
			payload: {
				scheduleId: targetSchedule.id,
			},
		})

		return NextResponse.json({
			preparedPayment: null,
			paymentSession: null,
		})
	}

	const stripe = requireStripeServer()
	const stripeCustomerId = await ensureStripeCustomerForRentalCustomer({
		organizationId: viewer.activeOrganizationId,
		customerId: customerRecord.id,
		fullName: customerRecord.fullName,
		email: customerRecord.email,
		phone: customerRecord.phone,
		stripeCustomerId: customerRecord.stripeCustomerId,
	})

	if (paymentMethodType === "card" && !branchRecord?.stripeTerminalLocationId) {
		return jsonError(
			"This branch does not have a Stripe Terminal location configured.",
			400,
		)
	}

	let preparedPayment: typeof rentalPayment.$inferSelect | null = null
	let paymentSession: {
		mode: "payment" | "setup"
		clientSecret: string
		intentId: string
		paymentMethodType: "card" | "au_becs_debit"
		collectionSurface: "terminal_reader" | "direct_debit"
	} | null = null

	if (paymentMethodType === "card") {
		const shouldCollectNow =
			scopedRental.record.firstCollectionTiming === "setup"
		if (shouldCollectNow) {
			const paymentIntent = await stripe.paymentIntents.create(
				{
					amount: toStripeAmount(numericToNumber(targetSchedule.amount)),
					currency: targetSchedule.currency.toLowerCase(),
					customer: stripeCustomerId,
					payment_method_types: ["card_present"],
					capture_method: "automatic",
					metadata: {
						organizationId: viewer.activeOrganizationId,
						rentalId: scopedRental.record.id,
						scheduleId: targetSchedule.id,
					},
				},
				{
					idempotencyKey: `${viewer.activeOrganizationId}:${scopedRental.record.id}:${keyPrefix}:payment_intent`,
				},
			)

			preparedPayment = await upsertRentalPaymentAttempt({
				organizationId: viewer.activeOrganizationId,
				branchId: scopedRental.record.branchId,
				rentalId: scopedRental.record.id,
				scheduleId: targetSchedule.id,
				kind: "schedule_collection",
				status: "requires_action",
				provider: "stripe",
				paymentMethodType: "card",
				collectionSurface: "terminal_reader",
				amount: numericToNumber(targetSchedule.amount),
				currency: targetSchedule.currency,
				idempotencyKey: `${keyPrefix}:schedule_collection`,
				stripePaymentIntentId: paymentIntent.id,
			})
		}

		if (scopedRental.record.paymentPlanKind === "installment") {
			const setupIntent = await stripe.setupIntents.create(
				{
					customer: stripeCustomerId,
					payment_method_types: ["card_present"],
					usage: "off_session",
					metadata: {
						organizationId: viewer.activeOrganizationId,
						rentalId: scopedRental.record.id,
					},
				},
				{
					idempotencyKey: `${viewer.activeOrganizationId}:${scopedRental.record.id}:${keyPrefix}:setup_intent`,
				},
			)

			await upsertRentalPaymentAttempt({
				organizationId: viewer.activeOrganizationId,
				branchId: scopedRental.record.branchId,
				rentalId: scopedRental.record.id,
				kind: "payment_method_setup",
				status: "requires_action",
				provider: "stripe",
				paymentMethodType: "card",
				collectionSurface: "terminal_reader",
				amount: 0,
				currency: targetSchedule.currency,
				idempotencyKey: `${keyPrefix}:payment_method_setup`,
				stripeSetupIntentId: setupIntent.id,
			})
		}
	} else if (paymentMethodType === "au_becs_debit") {
		const shouldCollectNow =
			scopedRental.record.firstCollectionTiming === "setup"
		if (shouldCollectNow) {
			const paymentIntent = await stripe.paymentIntents.create(
				{
					amount: toStripeAmount(numericToNumber(targetSchedule.amount)),
					currency: targetSchedule.currency.toLowerCase(),
					customer: stripeCustomerId,
					payment_method_types: ["au_becs_debit"],
					setup_future_usage:
						scopedRental.record.paymentPlanKind === "installment"
							? "off_session"
							: undefined,
					metadata: {
						organizationId: viewer.activeOrganizationId,
						rentalId: scopedRental.record.id,
						scheduleId: targetSchedule.id,
					},
				},
				{
					idempotencyKey: `${viewer.activeOrganizationId}:${scopedRental.record.id}:${keyPrefix}:au_becs_payment_intent`,
				},
			)

			preparedPayment = await upsertRentalPaymentAttempt({
				organizationId: viewer.activeOrganizationId,
				branchId: scopedRental.record.branchId,
				rentalId: scopedRental.record.id,
				scheduleId: targetSchedule.id,
				kind: "schedule_collection",
				status: "requires_action",
				provider: "stripe",
				paymentMethodType: "au_becs_debit",
				collectionSurface: "direct_debit",
				amount: numericToNumber(targetSchedule.amount),
				currency: targetSchedule.currency,
				idempotencyKey: `${keyPrefix}:schedule_collection`,
				stripePaymentIntentId: paymentIntent.id,
			})

			if (!paymentIntent.client_secret) {
				return jsonError("Stripe did not return a payment client secret.", 502)
			}

			paymentSession = {
				mode: "payment",
				clientSecret: paymentIntent.client_secret,
				intentId: paymentIntent.id,
				paymentMethodType: "au_becs_debit",
				collectionSurface: "direct_debit",
			}
		} else {
			const setupIntent = await stripe.setupIntents.create(
				{
					customer: stripeCustomerId,
					usage: "off_session",
					payment_method_types: ["au_becs_debit"],
					metadata: {
						organizationId: viewer.activeOrganizationId,
						rentalId: scopedRental.record.id,
					},
				},
				{
					idempotencyKey: `${viewer.activeOrganizationId}:${scopedRental.record.id}:${keyPrefix}:au_becs_setup_intent`,
				},
			)

			preparedPayment = await upsertRentalPaymentAttempt({
				organizationId: viewer.activeOrganizationId,
				branchId: scopedRental.record.branchId,
				rentalId: scopedRental.record.id,
				kind: "payment_method_setup",
				status: "requires_action",
				provider: "stripe",
				paymentMethodType: "au_becs_debit",
				collectionSurface: "direct_debit",
				amount: 0,
				currency: targetSchedule.currency,
				idempotencyKey: `${keyPrefix}:payment_method_setup`,
				stripeSetupIntentId: setupIntent.id,
			})

			if (!setupIntent.client_secret) {
				return jsonError("Stripe did not return a setup client secret.", 502)
			}

			paymentSession = {
				mode: "setup",
				clientSecret: setupIntent.client_secret,
				intentId: setupIntent.id,
				paymentMethodType: "au_becs_debit",
				collectionSurface: "direct_debit",
			}
		}
	}

	await logRentalEvent({
		viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.payment.prepared",
		payload: {
			paymentMethodType,
			scheduleId: targetSchedule.id,
			paymentIntentId: preparedPayment?.stripePaymentIntentId ?? null,
			setupIntentId: preparedPayment?.stripeSetupIntentId ?? null,
		},
	})

	return NextResponse.json({
		preparedPayment: preparedPayment
			? mapRentalPaymentRecord(preparedPayment)
			: null,
		paymentSession,
	})
}
