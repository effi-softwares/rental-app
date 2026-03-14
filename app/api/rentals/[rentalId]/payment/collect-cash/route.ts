import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import {
	rental,
	rentalPayment,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import {
	getScopedRentalForViewer,
	logRentalEvent,
	mapRentalPaymentRecord,
	numericToNumber,
} from "../../../_lib"

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

	const payload = (await request.json().catch(() => null)) as {
		scheduleId?: string
		amountTendered?: number
	} | null

	const scheduleId = payload?.scheduleId?.trim()
	const amountTendered =
		typeof payload?.amountTendered === "number" ? payload.amountTendered : NaN

	if (!scheduleId || !Number.isFinite(amountTendered)) {
		return jsonError("Schedule id and tendered amount are required.", 400)
	}

	const scheduleRows = await db
		.select()
		.from(rentalPaymentSchedule)
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, viewer.activeOrganizationId),
				eq(rentalPaymentSchedule.rentalId, scopedRental.record.id),
				eq(rentalPaymentSchedule.id, scheduleId),
			),
		)
		.limit(1)

	const schedule = scheduleRows[0]
	if (!schedule) {
		return jsonError("Payment schedule row was not found.", 404)
	}

	const dueAmount = numericToNumber(schedule.amount)
	if (amountTendered < dueAmount) {
		return jsonError("Tendered amount is less than the due amount.", 400)
	}

	const changeDue = Number((amountTendered - dueAmount).toFixed(2))

	const [payment] = await db
		.insert(rentalPayment)
		.values({
			organizationId: viewer.activeOrganizationId,
			branchId: scopedRental.record.branchId,
			rentalId: scopedRental.record.id,
			scheduleId: schedule.id,
			kind: "schedule_collection",
			status: "succeeded",
			provider: "manual",
			paymentMethodType: "cash",
			collectionSurface: "cash_register",
			amount: dueAmount.toFixed(2),
			currency: schedule.currency,
			manualReference: `cash:${schedule.id}`,
			metadata: {
				amountTendered,
				changeDue,
			},
			capturedAt: new Date(),
		})
		.returning()

	await db
		.update(rentalPaymentSchedule)
		.set({
			status: "succeeded",
			paymentMethodType: "cash",
			settledAt: new Date(),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, viewer.activeOrganizationId),
				eq(rentalPaymentSchedule.id, schedule.id),
			),
		)

	await db
		.update(rental)
		.set({
			selectedPaymentMethodType: "cash",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rental.organizationId, viewer.activeOrganizationId),
				eq(rental.id, scopedRental.record.id),
			),
		)

	await logRentalEvent({
		viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.payment.cash_collected",
		payload: {
			scheduleId: schedule.id,
			amountTendered,
			changeDue,
		},
	})

	return NextResponse.json({
		payment: mapRentalPaymentRecord(payment),
		changeDue,
	})
}
