import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { getViewerMembershipId } from "@/lib/authorization/server"
import { cancelRentalBeforeHandover } from "@/lib/rentals/cancellation"
import { getRentalDetailResponse } from "../../_flow"
import { getScopedRentalForViewer, logRentalEvent } from "../../_lib"

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

	if (
		scopedRental.record.actualStartAt ||
		(scopedRental.record.status !== "draft" &&
			scopedRental.record.status !== "awaiting_payment" &&
			scopedRental.record.status !== "scheduled")
	) {
		return jsonError(
			"Only rentals that have not been handed over can be cancelled.",
			400,
		)
	}

	const payload = (await request.json().catch(() => null)) as {
		reason?:
			| "customer_request"
			| "payment_issue"
			| "vehicle_unavailable"
			| "pricing_error"
			| "duplicate_booking"
			| "staff_error"
			| "other"
		note?: string
	} | null

	if (
		!payload?.reason ||
		![
			"customer_request",
			"payment_issue",
			"vehicle_unavailable",
			"pricing_error",
			"duplicate_booking",
			"staff_error",
			"other",
		].includes(payload.reason)
	) {
		return jsonError("A valid cancellation reason is required.", 400)
	}

	const memberId = await getViewerMembershipId(viewer)

	await cancelRentalBeforeHandover({
		organizationId: viewer.activeOrganizationId,
		rentalId: scopedRental.record.id,
		reason: payload.reason,
		note: payload.note,
		requestedByMemberId: memberId,
	})

	await logRentalEvent({
		viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.cancellation.requested",
		payload: {
			reason: payload.reason,
			note: payload.note?.trim() || null,
		},
	})

	const detail = await getRentalDetailResponse(viewer, scopedRental.record.id)
	if ("error" in detail) {
		return detail.error
	}

	return NextResponse.json({
		rentalId: detail.rental.id,
		status: detail.rental.status,
		cancellation: detail.cancellation,
		refunds: detail.refunds,
	})
}
