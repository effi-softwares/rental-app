import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import {
	rental,
	rentalPayment,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import { getRentalStoredMethodStateFromStripeConfirmation } from "@/lib/stripe/rental-billing"
import { requireStripeServer } from "@/lib/stripe/server"
import {
	getScopedRentalForViewer,
	logRentalEvent,
	mapRentalPaymentRecord,
} from "../../../_lib"

type RouteProps = {
	params: Promise<{
		rentalId: string
	}>
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

	const payload = (await request.json().catch(() => ({}))) as {
		paymentIntentId?: string
		setupIntentId?: string
	}

	if (!payload.paymentIntentId?.trim() && !payload.setupIntentId?.trim()) {
		return jsonError("A Stripe payment or setup intent id is required.", 400)
	}

	const stripe = requireStripeServer()
	const paymentIntentId = payload.paymentIntentId?.trim() || null
	const setupIntentId = payload.setupIntentId?.trim() || null
	const referencePredicate = paymentIntentId
		? eq(rentalPayment.stripePaymentIntentId, paymentIntentId)
		: eq(rentalPayment.stripeSetupIntentId, setupIntentId ?? "")

	const stripeObject = paymentIntentId
		? await stripe.paymentIntents.retrieve(paymentIntentId)
		: setupIntentId
			? await stripe.setupIntents.retrieve(setupIntentId)
			: null

	const resolvedStripePaymentMethodId =
		stripeObject &&
		"payment_method" in stripeObject &&
		typeof stripeObject.payment_method === "string"
			? stripeObject.payment_method
			: stripeObject &&
					"payment_method" in stripeObject &&
					typeof stripeObject.payment_method === "object" &&
					stripeObject.payment_method !== null &&
					"id" in stripeObject.payment_method
				? String(stripeObject.payment_method.id)
				: null

	const status =
		stripeObject &&
		"object" in stripeObject &&
		stripeObject.object === "payment_intent"
			? normalizePaymentIntentStatus(stripeObject.status)
			: stripeObject &&
					"object" in stripeObject &&
					stripeObject.object === "setup_intent"
				? normalizeSetupIntentStatus(stripeObject.status)
				: "failed"

	const matchedRows = await db
		.select()
		.from(rentalPayment)
		.where(
			and(
				eq(rentalPayment.organizationId, viewer.activeOrganizationId),
				eq(rentalPayment.rentalId, scopedRental.record.id),
				referencePredicate,
			),
		)

	if (matchedRows.length === 0) {
		return jsonError(
			"No prepared rental payment matched that Stripe intent.",
			404,
		)
	}

	const now = new Date()
	await db
		.update(rentalPayment)
		.set({
			status,
			stripePaymentMethodId: resolvedStripePaymentMethodId,
			capturedAt: status === "succeeded" ? now : null,
			updatedAt: now,
		})
		.where(
			and(
				eq(rentalPayment.organizationId, viewer.activeOrganizationId),
				eq(rentalPayment.rentalId, scopedRental.record.id),
				referencePredicate,
			),
		)

	for (const matched of matchedRows) {
		if (matched.scheduleId && status === "succeeded") {
			await db
				.update(rentalPaymentSchedule)
				.set({
					status: "succeeded",
					paymentMethodType: matched.paymentMethodType,
					settledAt: now,
					updatedAt: now,
				})
				.where(
					and(
						eq(
							rentalPaymentSchedule.organizationId,
							viewer.activeOrganizationId,
						),
						eq(rentalPaymentSchedule.id, matched.scheduleId),
					),
				)
		}

		const nextStoredMethodState =
			getRentalStoredMethodStateFromStripeConfirmation({
				paymentPlanKind: scopedRental.record.paymentPlanKind,
				paymentMethodType: matched.paymentMethodType,
				paymentAttemptKind: matched.kind,
				status,
				resolvedStripePaymentMethodId,
				currentRecurringBillingState: scopedRental.record.recurringBillingState,
			})

		if (nextStoredMethodState) {
			await db
				.update(rental)
				.set({
					...nextStoredMethodState,
					updatedAt: now,
				})
				.where(
					and(
						eq(rental.organizationId, viewer.activeOrganizationId),
						eq(rental.id, scopedRental.record.id),
					),
				)
		}
	}

	const reconciledPayments = await db
		.select()
		.from(rentalPayment)
		.where(
			and(
				eq(rentalPayment.organizationId, viewer.activeOrganizationId),
				eq(rentalPayment.rentalId, scopedRental.record.id),
			),
		)

	await logRentalEvent({
		viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.payment.confirmed",
		payload: {
			paymentIntentId,
			setupIntentId,
			status,
		},
	})

	return NextResponse.json({
		status,
		reconciledPayments: reconciledPayments.map((item) =>
			mapRentalPaymentRecord(item),
		),
	})
}
