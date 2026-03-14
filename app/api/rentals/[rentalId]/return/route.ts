import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { rental, rentalDamage } from "@/lib/db/schema/rentals"
import { vehicle } from "@/lib/db/schema/vehicles"
import { getScopedRentalForViewer, logRentalEvent } from "../../_lib"

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
