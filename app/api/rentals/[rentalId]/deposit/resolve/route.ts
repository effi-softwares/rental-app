import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { getViewerMembershipId } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { rentalCharge, rentalDepositEvent } from "@/lib/db/schema/rentals"
import {
	getScopedRentalForViewer,
	logRentalEvent,
	mapRentalChargeRecord,
	mapRentalDepositEventRecord,
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

	const { rentalId } = await params
	const scopedRental = await getScopedRentalForViewer(guard.viewer, rentalId)

	if ("error" in scopedRental) {
		return scopedRental.error
	}

	const payload = (await request.json().catch(() => null)) as
		| {
				action?: "release" | "refund" | "retain"
				amount?: number
				note?: string
		  }
		| {
				action?: "apply_to_charge"
				amount?: number
				chargeId?: string
				note?: string
		  }
		| null

	if (
		!payload?.action ||
		typeof payload.amount !== "number" ||
		payload.amount <= 0
	) {
		return jsonError("Deposit action and amount are required.", 400)
	}

	const existingEvents = await db
		.select()
		.from(rentalDepositEvent)
		.where(
			and(
				eq(
					rentalDepositEvent.organizationId,
					guard.viewer.activeOrganizationId,
				),
				eq(rentalDepositEvent.rentalId, scopedRental.record.id),
			),
		)

	const depositAmount =
		scopedRental.record.depositAmount === null
			? 0
			: numericToNumber(scopedRental.record.depositAmount)
	const resolvedAmount = existingEvents.reduce((total, event) => {
		if (
			event.type === "released" ||
			event.type === "refunded" ||
			event.type === "retained" ||
			event.type === "applied_to_charge"
		) {
			return total + numericToNumber(event.amount)
		}

		return total
	}, 0)
	const availableDeposit = Math.max(depositAmount - resolvedAmount, 0)

	if (payload.amount > availableDeposit) {
		return jsonError("Deposit action exceeds the remaining held amount.", 400)
	}

	const memberId = await getViewerMembershipId(guard.viewer)
	const depositEventType =
		payload.action === "release"
			? "released"
			: payload.action === "refund"
				? "refunded"
				: payload.action === "retain"
					? "retained"
					: "applied_to_charge"
	let updatedCharge: typeof rentalCharge.$inferSelect | null = null

	if (payload.action === "apply_to_charge") {
		const chargeId = payload.chargeId?.trim()
		if (!chargeId) {
			return jsonError(
				"Charge id is required when applying deposit to a charge.",
				400,
			)
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

		const totalApplied = existingEvents
			.filter(
				(event) =>
					event.type === "applied_to_charge" &&
					event.linkedChargeId === charge.id,
			)
			.reduce((total, event) => total + numericToNumber(event.amount), 0)
		const nextApplied = totalApplied + payload.amount
		const chargeTotal = numericToNumber(charge.total)

		;[updatedCharge] = await db
			.update(rentalCharge)
			.set({
				status:
					nextApplied >= chargeTotal
						? "paid"
						: nextApplied > 0
							? "partially_paid"
							: charge.status,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(rentalCharge.organizationId, guard.viewer.activeOrganizationId),
					eq(rentalCharge.id, charge.id),
				),
			)
			.returning()
	}

	const [depositEvent] = await db
		.insert(rentalDepositEvent)
		.values({
			organizationId: guard.viewer.activeOrganizationId,
			branchId: scopedRental.record.branchId,
			rentalId: scopedRental.record.id,
			type: depositEventType,
			amount: payload.amount.toFixed(2),
			currency: scopedRental.record.currency,
			linkedChargeId:
				payload.action === "apply_to_charge"
					? payload.chargeId?.trim() || null
					: null,
			linkedPaymentId: null,
			note: payload.note?.trim() || null,
			createdByMemberId: memberId,
		})
		.returning()

	await logRentalEvent({
		viewer: guard.viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.deposit.resolved",
		payload: {
			depositEventId: depositEvent.id,
			action: depositEvent.type,
			amount: payload.amount,
			chargeId:
				payload.action === "apply_to_charge"
					? payload.chargeId?.trim() || null
					: null,
		},
	})

	return NextResponse.json({
		depositEvent: mapRentalDepositEventRecord(depositEvent),
		charge: updatedCharge ? mapRentalChargeRecord(updatedCharge) : null,
	})
}
