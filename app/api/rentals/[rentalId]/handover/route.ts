import { and, asc, eq, inArray, lte } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import {
	rental,
	rentalInspection,
	rentalPayment,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import { vehicle } from "@/lib/db/schema/vehicles"
import { ensureRecurringBillingForRental } from "@/lib/stripe/rental-billing"
import {
	getCustomerForFinalize,
	getScopedRentalForViewer,
	hasReachableCustomerContact,
	logRentalEvent,
	mapRentalPaymentRecord,
	numericToNumber,
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

	if (!scopedRental.record.vehicleId) {
		return jsonError("Rental vehicle is missing.", 400)
	}

	if (
		scopedRental.record.status !== "scheduled" &&
		scopedRental.record.status !== "awaiting_payment"
	) {
		return jsonError("Only scheduled rentals can be handed over.", 400)
	}

	if (!scopedRental.record.selectedPaymentMethodType) {
		return jsonError("Payment method setup is missing for this rental.", 400)
	}

	const pickupInspection = await db
		.select({ id: rentalInspection.id })
		.from(rentalInspection)
		.where(
			and(
				eq(rentalInspection.organizationId, viewer.activeOrganizationId),
				eq(rentalInspection.rentalId, scopedRental.record.id),
				eq(rentalInspection.stage, "pickup"),
			),
		)
		.limit(1)
		.then((rows) => rows[0] ?? null)

	if (!pickupInspection) {
		return jsonError(
			"Save the handover inspection before activating this rental.",
			400,
		)
	}

	const payload = (await request.json().catch(() => ({}))) as {
		amountTendered?: number
	}

	const now = new Date()
	const dueScheduleRows = await db
		.select()
		.from(rentalPaymentSchedule)
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, viewer.activeOrganizationId),
				eq(rentalPaymentSchedule.rentalId, scopedRental.record.id),
				inArray(rentalPaymentSchedule.status, [
					"pending",
					"processing",
					"failed",
				]),
				lte(rentalPaymentSchedule.dueAt, now),
			),
		)
		.orderBy(asc(rentalPaymentSchedule.sequence))

	if (
		scopedRental.record.selectedPaymentMethodType === "cash" &&
		dueScheduleRows.length > 0
	) {
		if (dueScheduleRows.length > 1) {
			return jsonError(
				"Multiple cash installments are overdue. Collect them individually before handover.",
				400,
			)
		}

		const firstDue = dueScheduleRows[0]
		const amountTendered =
			typeof payload.amountTendered === "number" ? payload.amountTendered : NaN
		const dueAmount = numericToNumber(firstDue.amount)

		if (!Number.isFinite(amountTendered)) {
			return jsonError(
				"Amount tendered is required to collect the due cash payment at handover.",
				400,
			)
		}

		if (amountTendered < dueAmount) {
			return jsonError("Tendered cash is less than the due amount.", 400)
		}

		const changeDue = Number((amountTendered - dueAmount).toFixed(2))
		await db.insert(rentalPayment).values({
			organizationId: viewer.activeOrganizationId,
			branchId: scopedRental.record.branchId,
			rentalId: scopedRental.record.id,
			scheduleId: firstDue.id,
			kind: "schedule_collection",
			status: "succeeded",
			provider: "manual",
			paymentMethodType: "cash",
			collectionSurface: "cash_register",
			amount: dueAmount.toFixed(2),
			currency: firstDue.currency,
			manualReference: `handover-cash:${firstDue.id}`,
			metadata: {
				amountTendered,
				changeDue,
			},
			capturedAt: now,
		})

		await db
			.update(rentalPaymentSchedule)
			.set({
				status: "succeeded",
				paymentMethodType: "cash",
				settledAt: now,
				updatedAt: now,
			})
			.where(
				and(
					eq(rentalPaymentSchedule.organizationId, viewer.activeOrganizationId),
					eq(rentalPaymentSchedule.id, firstDue.id),
				),
			)
	}

	const refreshedDueRows = await db
		.select()
		.from(rentalPaymentSchedule)
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, viewer.activeOrganizationId),
				eq(rentalPaymentSchedule.rentalId, scopedRental.record.id),
				inArray(rentalPaymentSchedule.status, [
					"pending",
					"processing",
					"failed",
				]),
				lte(rentalPaymentSchedule.dueAt, now),
			),
		)
		.orderBy(asc(rentalPaymentSchedule.sequence))

	if (refreshedDueRows.length > 0) {
		if (scopedRental.record.selectedPaymentMethodType === "au_becs_debit") {
			await db
				.update(rental)
				.set({
					status: "awaiting_payment",
					updatedAt: now,
					version: scopedRental.record.version + 1,
				})
				.where(
					and(
						eq(rental.organizationId, viewer.activeOrganizationId),
						eq(rental.id, scopedRental.record.id),
					),
				)

			return NextResponse.json({
				rentalId: scopedRental.record.id,
				status: "awaiting_payment",
				capturedPayments: [],
			})
		}

		return jsonError(
			"Due-at-handover payments are not settled yet. Complete payment before handover.",
			400,
		)
	}

	const capturedPayments = await db
		.select()
		.from(rentalPayment)
		.where(
			and(
				eq(rentalPayment.organizationId, viewer.activeOrganizationId),
				eq(rentalPayment.rentalId, scopedRental.record.id),
				eq(rentalPayment.status, "succeeded"),
			),
		)

	let recurringBillingState = scopedRental.record.recurringBillingState
	if (
		scopedRental.record.paymentPlanKind === "installment" &&
		scopedRental.record.selectedPaymentMethodType !== "cash" &&
		scopedRental.record.firstCollectionTiming === "handover"
	) {
		const existingRecurringScheduleId =
			capturedPayments.find((payment) => payment.stripeSubscriptionScheduleId)
				?.stripeSubscriptionScheduleId ?? null

		if (existingRecurringScheduleId) {
			recurringBillingState = "scheduled_in_stripe"
		} else if (
			scopedRental.record.installmentInterval &&
			scopedRental.record.customerId
		) {
			const [customerRecord, allPaymentRows, remainingRows] = await Promise.all(
				[
					getCustomerForFinalize(
						viewer.activeOrganizationId,
						scopedRental.record.customerId,
					),
					db
						.select()
						.from(rentalPayment)
						.where(
							and(
								eq(rentalPayment.organizationId, viewer.activeOrganizationId),
								eq(rentalPayment.rentalId, scopedRental.record.id),
							),
						),
					db
						.select()
						.from(rentalPaymentSchedule)
						.where(
							and(
								eq(
									rentalPaymentSchedule.organizationId,
									viewer.activeOrganizationId,
								),
								eq(rentalPaymentSchedule.rentalId, scopedRental.record.id),
							),
						)
						.orderBy(asc(rentalPaymentSchedule.sequence)),
				],
			)

			if (!customerRecord || !hasReachableCustomerContact(customerRecord)) {
				return jsonError(
					"Customer must have at least one email or phone before handover.",
					400,
				)
			}

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
				paymentRows: allPaymentRows,
				scheduleRows: remainingRows,
			})

			recurringBillingState = recurringSchedule.recurringBillingState
		}
	}

	await db
		.update(rental)
		.set({
			status: "active",
			actualStartAt: scopedRental.record.actualStartAt ?? now,
			recurringBillingState,
			updatedAt: now,
			version: scopedRental.record.version + 1,
		})
		.where(
			and(
				eq(rental.organizationId, viewer.activeOrganizationId),
				eq(rental.id, scopedRental.record.id),
			),
		)

	await db
		.update(vehicle)
		.set({
			status: "Rented",
			updatedAt: now,
		})
		.where(
			and(
				eq(vehicle.organizationId, viewer.activeOrganizationId),
				eq(vehicle.id, scopedRental.record.vehicleId),
			),
		)

	await logRentalEvent({
		viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.handover.completed",
		payload: {
			capturedPaymentIds: capturedPayments.map((payment) => payment.id),
		},
	})

	return NextResponse.json({
		rentalId: scopedRental.record.id,
		status: "active",
		capturedPayments: capturedPayments.map((payment) =>
			mapRentalPaymentRecord(payment),
		),
	})
}
