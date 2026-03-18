import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { getViewerMembershipId } from "@/lib/authorization/server"
import { confirmCashRefundForRental } from "@/lib/rentals/cancellation"
import { getRentalDetailResponse } from "../../../../_flow"
import { getScopedRentalForViewer, logRentalEvent } from "../../../../_lib"

type RouteProps = {
	params: Promise<{
		rentalId: string
		refundId: string
	}>
}

export async function POST(_: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "managePaymentsModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const { rentalId, refundId } = await params
	const scopedRental = await getScopedRentalForViewer(viewer, rentalId)

	if ("error" in scopedRental) {
		return scopedRental.error
	}

	if (scopedRental.record.status !== "cancelling") {
		return jsonError(
			"Cash refunds can only be confirmed while cancellation is in progress.",
			400,
		)
	}

	const memberId = await getViewerMembershipId(viewer)
	const refund = await confirmCashRefundForRental({
		organizationId: viewer.activeOrganizationId,
		rentalId: scopedRental.record.id,
		refundId,
		confirmedByMemberId: memberId,
	})

	if (!refund) {
		return jsonError("Pending cash refund was not found.", 404)
	}

	await logRentalEvent({
		viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.cancellation.cash_refund_confirmed",
		payload: {
			refundId: refund.id,
			paymentId: refund.paymentId,
			amount: Number(refund.amount),
		},
	})

	const detail = await getRentalDetailResponse(viewer, scopedRental.record.id)
	if ("error" in detail) {
		return detail.error
	}

	const refundSummary = detail.refunds.find((entry) => entry.id === refund.id)
	if (!refundSummary) {
		return jsonError(
			"Refund confirmation completed but the summary is missing.",
			500,
		)
	}

	return NextResponse.json({
		rentalId: detail.rental.id,
		status: detail.rental.status,
		refund: refundSummary,
	})
}
