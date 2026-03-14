import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { rentalCharge } from "@/lib/db/schema/rentals"
import {
	getScopedRentalForViewer,
	logRentalEvent,
	mapRentalChargeRecord,
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

	const { rentalId } = await params
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
		metadata?: Record<string, unknown>
	} | null

	if (
		!payload?.kind ||
		typeof payload.amount !== "number" ||
		payload.amount < 0
	) {
		return jsonError("Charge kind and amount are required.", 400)
	}

	const taxAmount = Math.max(0, payload.taxAmount ?? 0)
	const total = Number((payload.amount + taxAmount).toFixed(2))
	const dueAt =
		payload.dueAt && !Number.isNaN(new Date(payload.dueAt).getTime())
			? new Date(payload.dueAt)
			: null

	const [charge] = await db
		.insert(rentalCharge)
		.values({
			organizationId: guard.viewer.activeOrganizationId,
			branchId: scopedRental.record.branchId,
			rentalId: scopedRental.record.id,
			linkedDamageId: payload.linkedDamageId?.trim() || null,
			kind: payload.kind,
			status: "open",
			amount: payload.amount.toFixed(2),
			taxAmount: taxAmount.toFixed(2),
			total: total.toFixed(2),
			currency: scopedRental.record.currency,
			dueAt,
			description: payload.description?.trim() || null,
			metadata: payload.metadata ?? {},
		})
		.returning()

	await logRentalEvent({
		viewer: guard.viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.charge.created",
		payload: {
			chargeId: charge.id,
			kind: charge.kind,
			total,
		},
	})

	return NextResponse.json({
		charge: mapRentalChargeRecord(charge),
	})
}
