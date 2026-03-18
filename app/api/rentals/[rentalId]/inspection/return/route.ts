import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { getScopedRentalForViewer } from "../../../_lib"
import { saveRentalInspection } from "../_lib"

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

	const { rentalId } = await params
	const scopedRental = await getScopedRentalForViewer(guard.viewer, rentalId)

	if ("error" in scopedRental) {
		return scopedRental.error
	}

	if (
		scopedRental.record.status !== "scheduled" &&
		scopedRental.record.status !== "active" &&
		scopedRental.record.status !== "completed"
	) {
		return jsonError(
			"Return inspection can only be recorded for scheduled, active, or completed rentals.",
			400,
		)
	}

	const payload = (await request.json().catch(() => null)) as
		| Parameters<typeof saveRentalInspection>[0]["payload"]
		| null

	if (!payload) {
		return jsonError("Inspection payload is required.", 400)
	}

	if (!payload.conditionRating) {
		return jsonError("Select a return condition rating before saving.", 400)
	}

	if (!Array.isArray(payload.media) || payload.media.length === 0) {
		return jsonError(
			"Add at least one photo or video proof before saving the return condition.",
			400,
		)
	}

	const result = await saveRentalInspection({
		viewer: guard.viewer,
		rentalId: scopedRental.record.id,
		vehicleId: scopedRental.record.vehicleId,
		branchId: scopedRental.record.branchId,
		stage: "return",
		payload,
	})

	return NextResponse.json(result)
}
