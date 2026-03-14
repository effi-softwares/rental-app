import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { rentalCharge, rentalPayment } from "@/lib/db/schema/rentals"
import {
	getScopedRentalForViewer,
	logRentalEvent,
	mapRentalChargeRecord,
	mapRentalPaymentRecord,
	numericToNumber,
} from "../../../../_lib"

type RouteProps = {
	params: Promise<{
		rentalId: string
		chargeId: string
	}>
}

export async function POST(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "managePaymentsModule" })

	if (guard.response) {
		return guard.response
	}

	const { rentalId, chargeId } = await params
	const scopedRental = await getScopedRentalForViewer(guard.viewer, rentalId)

	if ("error" in scopedRental) {
		return scopedRental.error
	}

	const charge = await db
		.select()
		.from(rentalCharge)
		.where(
			and(
				eq(rentalCharge.organizationId, guard.viewer.activeOrganizationId),
				eq(rentalCharge.rentalId, scopedRental.record.id),
				eq(rentalCharge.id, chargeId),
			),
		)
		.limit(1)
		.then((rows) => rows[0] ?? null)

	if (!charge) {
		return jsonError("Charge not found.", 404)
	}

	if (charge.status === "paid" || charge.status === "cancelled") {
		return jsonError("This charge cannot be collected.", 400)
	}

	const payload = (await request.json().catch(() => null)) as {
		paymentMethodType?: "cash" | "card"
		amountTendered?: number
		manualReference?: string
	} | null

	if (
		payload?.paymentMethodType !== "cash" &&
		payload?.paymentMethodType !== "card"
	) {
		return jsonError("A supported collection method is required.", 400)
	}

	const total = numericToNumber(charge.total)
	const amountTendered =
		typeof payload.amountTendered === "number" ? payload.amountTendered : total

	if (payload.paymentMethodType === "cash" && amountTendered < total) {
		return jsonError("Tendered amount is less than the charge total.", 400)
	}

	const changeDue =
		payload.paymentMethodType === "cash"
			? Number((amountTendered - total).toFixed(2))
			: 0

	const [payment] = await db
		.insert(rentalPayment)
		.values({
			organizationId: guard.viewer.activeOrganizationId,
			branchId: scopedRental.record.branchId,
			rentalId: scopedRental.record.id,
			kind: "schedule_collection",
			status: "succeeded",
			provider: "manual",
			paymentMethodType: payload.paymentMethodType,
			collectionSurface:
				payload.paymentMethodType === "cash" ? "cash_register" : null,
			amount: total.toFixed(2),
			currency: charge.currency,
			manualReference:
				payload.manualReference?.trim() ||
				`${payload.paymentMethodType}:charge:${charge.id}`,
			metadata: {
				chargeId: charge.id,
				amountTendered,
				changeDue,
			},
			capturedAt: new Date(),
		})
		.returning()

	const [updatedCharge] = await db
		.update(rentalCharge)
		.set({
			status: "paid",
			linkedPaymentId: payment.id,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rentalCharge.organizationId, guard.viewer.activeOrganizationId),
				eq(rentalCharge.id, charge.id),
			),
		)
		.returning()

	await logRentalEvent({
		viewer: guard.viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.charge.collected",
		payload: {
			chargeId: updatedCharge.id,
			paymentId: payment.id,
			paymentMethodType: payload.paymentMethodType,
			total,
		},
	})

	return NextResponse.json({
		charge: mapRentalChargeRecord(updatedCharge),
		payment: mapRentalPaymentRecord(payment),
		changeDue,
	})
}
