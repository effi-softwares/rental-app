import { createHash } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import {
	getScopedBranchIdsForViewer,
	getViewerMembershipId,
} from "@/lib/authorization/server"
import { db } from "@/lib/db"
import {
	rental,
	rentalAgreement,
	rentalInvoice,
	rentalPayment,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import {
	checkRentalAvailability,
	releaseRentalDraftHold,
} from "@/lib/rentals/availability"
import { ensureRecurringBillingForRental } from "@/lib/stripe/rental-billing"
import {
	getCustomerForFinalize,
	getScopedRentalForViewer,
	hasReachableCustomerContact,
	logRentalEvent,
} from "../../_lib"

type RouteProps = {
	params: Promise<{
		rentalId: string
	}>
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
		signature?: string
		signerName?: string
		agreementAccepted?: boolean
	}

	const signature = payload.signature?.trim() ?? ""
	const signerName = payload.signerName?.trim() || null

	if (!payload.agreementAccepted) {
		return jsonError("Agreement confirmation is required.", 400)
	}

	if (!signature) {
		return jsonError(
			"Agreement signature is required before finalization.",
			400,
		)
	}

	if (!scopedRental.record.vehicleId) {
		return jsonError("Select a vehicle before finalizing rental.", 400)
	}

	if (
		!scopedRental.record.plannedStartAt ||
		!scopedRental.record.plannedEndAt
	) {
		return jsonError("Schedule must be confirmed before finalization.", 400)
	}

	if (!scopedRental.record.customerId) {
		return jsonError("Assign a customer before finalizing rental.", 400)
	}

	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)
	const availability = await checkRentalAvailability({
		organizationId: viewer.activeOrganizationId,
		vehicleId: scopedRental.record.vehicleId,
		startsAt: scopedRental.record.plannedStartAt,
		endsAt: scopedRental.record.plannedEndAt,
		rentalId: scopedRental.record.id,
		scopedBranchIds,
	})

	if (!availability.isAvailable) {
		return jsonError(
			availability.blockingReason ??
				"Vehicle availability changed. Reconfirm the schedule before finalizing.",
			409,
		)
	}

	const [customerRecord, scheduleRows, paymentRows] = await Promise.all([
		getCustomerForFinalize(
			viewer.activeOrganizationId,
			scopedRental.record.customerId,
		),
		db
			.select()
			.from(rentalPaymentSchedule)
			.where(
				and(
					eq(rentalPaymentSchedule.organizationId, viewer.activeOrganizationId),
					eq(rentalPaymentSchedule.rentalId, scopedRental.record.id),
				),
			)
			.orderBy(rentalPaymentSchedule.sequence),
		db
			.select()
			.from(rentalPayment)
			.where(
				and(
					eq(rentalPayment.organizationId, viewer.activeOrganizationId),
					eq(rentalPayment.rentalId, scopedRental.record.id),
				),
			),
	])

	if (!customerRecord || !hasReachableCustomerContact(customerRecord)) {
		return jsonError(
			"Customer must have at least one email or phone before finalization.",
			400,
		)
	}

	if (scheduleRows.length === 0) {
		return jsonError("Payment schedule is missing.", 400)
	}

	if (!scopedRental.record.selectedPaymentMethodType) {
		return jsonError(
			"Complete payment setup before finalizing the rental.",
			400,
		)
	}

	const firstSchedule = scheduleRows[0]
	if (!firstSchedule) {
		return jsonError("Payment schedule is missing.", 400)
	}

	const _setupPayments = paymentRows.filter(
		(payment) => payment.kind === "payment_method_setup",
	)
	const firstChargePayments = paymentRows.filter(
		(payment) => payment.scheduleId === firstSchedule.id,
	)

	if (
		scopedRental.record.paymentPlanKind === "installment" &&
		scopedRental.record.selectedPaymentMethodType !== "cash" &&
		scopedRental.record.storedPaymentMethodStatus !== "ready"
	) {
		return jsonError(
			"Saved payment method setup must succeed before finalization.",
			400,
		)
	}

	let nextStatus: typeof rental.$inferSelect.status = "scheduled"
	if (scopedRental.record.firstCollectionTiming === "setup") {
		if (
			scopedRental.record.selectedPaymentMethodType === "cash" ||
			scopedRental.record.selectedPaymentMethodType === "card"
		) {
			if (firstSchedule.status !== "succeeded") {
				return jsonError(
					"The first scheduled charge must be collected before finalization.",
					400,
				)
			}
		}

		if (scopedRental.record.selectedPaymentMethodType === "au_becs_debit") {
			if (firstSchedule.status === "succeeded") {
				nextStatus = "scheduled"
			} else {
				const pendingAttempt = firstChargePayments.find(
					(payment) =>
						payment.status === "processing" ||
						payment.status === "pending" ||
						payment.status === "requires_action",
				)

				if (!pendingAttempt) {
					return jsonError(
						"The first direct debit payment has not been initiated yet.",
						400,
					)
				}

				nextStatus = "awaiting_payment"
			}
		}
	}

	const signedAt = new Date()
	const documentHash = createHash("sha256")
		.update(
			JSON.stringify({
				rentalId: scopedRental.record.id,
				templateVersion: "v2",
				signedAt: signedAt.toISOString(),
				signature,
				signerName,
				paymentMethodType: scopedRental.record.selectedPaymentMethodType,
				paymentPlanKind: scopedRental.record.paymentPlanKind,
			}),
		)
		.digest("hex")

	const agreementRows = await db
		.select({ id: rentalAgreement.id })
		.from(rentalAgreement)
		.where(
			and(
				eq(rentalAgreement.organizationId, viewer.activeOrganizationId),
				eq(rentalAgreement.rentalId, scopedRental.record.id),
			),
		)
		.limit(1)

	if (agreementRows[0]) {
		await db
			.update(rentalAgreement)
			.set({
				templateVersion: "v2",
				documentHash,
				signedAt,
				signaturePayload: {
					signature,
					signerName,
					agreementAccepted: true,
				},
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(rentalAgreement.organizationId, viewer.activeOrganizationId),
					eq(rentalAgreement.rentalId, scopedRental.record.id),
				),
			)
	} else {
		await db.insert(rentalAgreement).values({
			organizationId: viewer.activeOrganizationId,
			branchId: scopedRental.record.branchId,
			rentalId: scopedRental.record.id,
			templateVersion: "v2",
			documentHash,
			signedAt,
			signaturePayload: {
				signature,
				signerName,
				agreementAccepted: true,
			},
		})
	}

	let recurringBillingState = scopedRental.record.recurringBillingState

	if (
		scopedRental.record.paymentPlanKind === "installment" &&
		scopedRental.record.selectedPaymentMethodType !== "cash"
	) {
		const existingRecurringScheduleId =
			paymentRows.find((payment) => payment.stripeSubscriptionScheduleId)
				?.stripeSubscriptionScheduleId ?? null

		if (existingRecurringScheduleId) {
			recurringBillingState = "scheduled_in_stripe"
		} else if (scopedRental.record.firstCollectionTiming === "setup") {
			if (scopedRental.record.installmentInterval) {
				const recurringSchedule = await ensureRecurringBillingForRental({
					organizationId: viewer.activeOrganizationId,
					rentalId: scopedRental.record.id,
					customer: {
						organizationId: viewer.activeOrganizationId,
						customerId: customerRecord.id,
						fullName: customerRecord.fullName,
						email: customerRecord.email,
						phone: customerRecord.phone,
						stripeCustomerId: customerRecord.stripeCustomerId,
					},
					currency: scopedRental.record.currency,
					installmentInterval: scopedRental.record.installmentInterval,
					paymentRows,
					scheduleRows,
				})

				recurringBillingState = recurringSchedule.recurringBillingState
			}
		} else {
			recurringBillingState = "ready_to_schedule"
		}
	}

	await db
		.update(rentalInvoice)
		.set({
			collectionMethod:
				scopedRental.record.paymentPlanKind === "installment" &&
				scopedRental.record.selectedPaymentMethodType !== "cash"
					? "charge_automatically"
					: "out_of_band",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rentalInvoice.organizationId, viewer.activeOrganizationId),
				eq(rentalInvoice.rentalId, scopedRental.record.id),
			),
		)

	await db
		.update(rental)
		.set({
			status: nextStatus,
			recurringBillingState,
			updatedAt: new Date(),
			version: scopedRental.record.version + 1,
		})
		.where(
			and(
				eq(rental.id, scopedRental.record.id),
				eq(rental.organizationId, viewer.activeOrganizationId),
			),
		)

	await releaseRentalDraftHold({
		organizationId: viewer.activeOrganizationId,
		rentalId: scopedRental.record.id,
		memberId: await getViewerMembershipId(viewer),
	})

	await logRentalEvent({
		viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.finalized",
		payload: {
			status: nextStatus,
			paymentPlanKind: scopedRental.record.paymentPlanKind,
			firstCollectionTiming: scopedRental.record.firstCollectionTiming,
			selectedPaymentMethodType: scopedRental.record.selectedPaymentMethodType,
		},
	})

	return NextResponse.json({
		rentalId: scopedRental.record.id,
		status: nextStatus,
	})
}
