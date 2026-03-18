import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import {
	rental,
	rentalCharge,
	rentalDamage,
	rentalDepositEvent,
	rentalInspection,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import { vehicle } from "@/lib/db/schema/vehicles"
import {
	getScopedRentalForViewer,
	logRentalEvent,
	numericToNumber,
} from "../../_lib"

type RouteProps = {
	params: Promise<{
		rentalId: string
	}>
}

export async function POST(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "viewBookingsModule" })

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
		scopedRental.record.status !== "active" &&
		scopedRental.record.status !== "scheduled"
	) {
		return jsonError("Only active or scheduled rentals can be returned.", 400)
	}

	const payload = (await request.json().catch(() => ({}))) as {
		actualEndAt?: string
		notes?: string
	}

	const now = new Date()
	const resolvedEndAt = payload.actualEndAt
		? new Date(payload.actualEndAt)
		: now

	if (Number.isNaN(resolvedEndAt.getTime())) {
		return jsonError("Invalid return timestamp.", 400)
	}

	const [returnInspection] = await db
		.select({
			id: rentalInspection.id,
			conditionRating: rentalInspection.conditionRating,
			mediaJson: rentalInspection.mediaJson,
		})
		.from(rentalInspection)
		.where(
			and(
				eq(rentalInspection.organizationId, viewer.activeOrganizationId),
				eq(rentalInspection.rentalId, scopedRental.record.id),
				eq(rentalInspection.stage, "return"),
			),
		)
		.limit(1)

	if (!returnInspection) {
		return jsonError(
			"Save the return inspection before completing the return.",
			400,
		)
	}

	if (!returnInspection.conditionRating) {
		return jsonError(
			"Add the return condition rating before completing the return.",
			400,
		)
	}

	if (
		!Array.isArray(returnInspection.mediaJson) ||
		returnInspection.mediaJson.length === 0
	) {
		return jsonError(
			"Add at least one return photo or video before completing the return.",
			400,
		)
	}

	const scheduleRows = await db
		.select({
			id: rentalPaymentSchedule.id,
			amount: rentalPaymentSchedule.amount,
			status: rentalPaymentSchedule.status,
		})
		.from(rentalPaymentSchedule)
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, viewer.activeOrganizationId),
				eq(rentalPaymentSchedule.rentalId, scopedRental.record.id),
			),
		)

	const outstandingScheduledBalance = scheduleRows
		.filter(
			(row) =>
				row.status === "pending" ||
				row.status === "processing" ||
				row.status === "failed",
		)
		.reduce((total, row) => total + numericToNumber(row.amount), 0)

	if (outstandingScheduledBalance > 0) {
		return jsonError(
			"Collect all outstanding scheduled payments before completing the return.",
			400,
		)
	}

	const openCharges = await db
		.select({
			id: rentalCharge.id,
			total: rentalCharge.total,
			status: rentalCharge.status,
		})
		.from(rentalCharge)
		.where(
			and(
				eq(rentalCharge.organizationId, viewer.activeOrganizationId),
				eq(rentalCharge.rentalId, scopedRental.record.id),
			),
		)

	const unresolvedCharges = openCharges.filter(
		(row) => row.status === "open" || row.status === "partially_paid",
	)

	if (unresolvedCharges.length > 0) {
		return jsonError(
			"Resolve all known return charges before completing the return.",
			400,
		)
	}

	const depositEvents = await db
		.select({
			type: rentalDepositEvent.type,
			amount: rentalDepositEvent.amount,
		})
		.from(rentalDepositEvent)
		.where(
			and(
				eq(rentalDepositEvent.organizationId, viewer.activeOrganizationId),
				eq(rentalDepositEvent.rentalId, scopedRental.record.id),
			),
		)

	const depositAmount =
		scopedRental.record.depositAmount === null
			? 0
			: numericToNumber(scopedRental.record.depositAmount)
	const depositReleased = depositEvents
		.filter((row) => row.type === "released" || row.type === "refunded")
		.reduce((total, row) => total + numericToNumber(row.amount), 0)
	const depositApplied = depositEvents
		.filter((row) => row.type === "applied_to_charge")
		.reduce((total, row) => total + numericToNumber(row.amount), 0)
	const depositRetained = depositEvents
		.filter((row) => row.type === "retained")
		.reduce((total, row) => total + numericToNumber(row.amount), 0)
	const depositHeld = Math.max(
		depositAmount - depositReleased - depositApplied - depositRetained,
		0,
	)

	if (scopedRental.record.depositRequired && depositHeld > 0) {
		return jsonError(
			"Resolve the held deposit before completing the return.",
			400,
		)
	}

	const unresolvedDamages = await db
		.select({
			id: rentalDamage.id,
			category: rentalDamage.category,
			severity: rentalDamage.severity,
			repairStatus: rentalDamage.repairStatus,
		})
		.from(rentalDamage)
		.where(
			and(
				eq(rentalDamage.organizationId, viewer.activeOrganizationId),
				eq(rentalDamage.rentalId, scopedRental.record.id),
			),
		)

	const shouldMoveToMaintenance = unresolvedDamages.some(
		(damage) =>
			damage.repairStatus !== "repaired" &&
			damage.repairStatus !== "waived" &&
			(damage.category === "mechanical" || damage.severity === "severe"),
	)

	await db
		.update(rental)
		.set({
			status: "completed",
			actualEndAt: resolvedEndAt,
			notes: payload.notes?.trim() || scopedRental.record.notes,
			updatedAt: now,
			version: scopedRental.record.version + 1,
		})
		.where(
			and(
				eq(rental.id, scopedRental.record.id),
				eq(rental.organizationId, viewer.activeOrganizationId),
			),
		)

	await db
		.update(vehicle)
		.set({
			status: shouldMoveToMaintenance ? "Maintenance" : "Available",
			updatedAt: now,
		})
		.where(
			and(
				eq(vehicle.id, scopedRental.record.vehicleId),
				eq(vehicle.organizationId, viewer.activeOrganizationId),
			),
		)

	await logRentalEvent({
		viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.return.completed",
		payload: {
			actualEndAt: resolvedEndAt.toISOString(),
			notes: payload.notes?.trim() || null,
			vehicleStatus: shouldMoveToMaintenance ? "Maintenance" : "Available",
		},
	})

	return NextResponse.json({
		rentalId: scopedRental.record.id,
		status: "completed",
		actualEndAt: resolvedEndAt.toISOString(),
	})
}
