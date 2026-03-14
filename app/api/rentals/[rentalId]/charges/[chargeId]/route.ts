import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { rentalCharge } from "@/lib/db/schema/rentals"
import {
	getScopedRentalForViewer,
	logRentalEvent,
	mapRentalChargeRecord,
	numericToNumber,
} from "../../../_lib"

type RouteProps = {
	params: Promise<{
		rentalId: string
		chargeId: string
	}>
}

export async function PATCH(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "managePaymentsModule" })

	if (guard.response) {
		return guard.response
	}

	const { rentalId, chargeId } = await params
	const scopedRental = await getScopedRentalForViewer(guard.viewer, rentalId)

	if ("error" in scopedRental) {
		return scopedRental.error
	}

	const payload = (await request.json().catch(() => null)) as {
		kind?:
			| "extension"
			| "damage"
			| "fine"
			| "toll"
			| "fuel"
			| "cleaning"
			| "late_return"
			| "other"
		amount?: number
		taxAmount?: number
		description?: string
		dueAt?: string | null
		linkedDamageId?: string | null
		status?: "open" | "partially_paid" | "paid" | "cancelled"
	} | null

	const existing = await db
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

	if (!existing) {
		return jsonError("Charge not found.", 404)
	}

	const nextAmount =
		typeof payload?.amount === "number"
			? Math.max(0, payload.amount)
			: numericToNumber(existing.amount)
	const nextTaxAmount =
		typeof payload?.taxAmount === "number"
			? Math.max(0, payload.taxAmount)
			: numericToNumber(existing.taxAmount)
	const dueAt =
		payload?.dueAt === undefined
			? existing.dueAt
			: payload.dueAt && !Number.isNaN(new Date(payload.dueAt).getTime())
				? new Date(payload.dueAt)
				: null

	const [charge] = await db
		.update(rentalCharge)
		.set({
			kind: payload?.kind ?? existing.kind,
			status: payload?.status ?? existing.status,
			amount: nextAmount.toFixed(2),
			taxAmount: nextTaxAmount.toFixed(2),
			total: (nextAmount + nextTaxAmount).toFixed(2),
			dueAt,
			description:
				payload?.description !== undefined
					? payload.description?.trim() || null
					: existing.description,
			linkedDamageId:
				payload?.linkedDamageId !== undefined
					? payload.linkedDamageId?.trim() || null
					: existing.linkedDamageId,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(rentalCharge.organizationId, guard.viewer.activeOrganizationId),
				eq(rentalCharge.id, existing.id),
			),
		)
		.returning()

	await logRentalEvent({
		viewer: guard.viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.charge.updated",
		payload: {
			chargeId: charge.id,
			status: charge.status,
			total: numericToNumber(charge.total),
		},
	})

	return NextResponse.json({
		charge: mapRentalChargeRecord(charge),
	})
}
