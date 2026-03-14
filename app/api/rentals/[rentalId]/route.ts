import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { commitRentalFlow, getRentalDetailResponse } from "../_flow"

type RouteProps = {
	params: Promise<{
		rentalId: string
	}>
}

export async function GET(_: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "viewBookingsModule" })

	if (guard.response) {
		return guard.response
	}

	const { rentalId } = await params
	const detail = await getRentalDetailResponse(guard.viewer, rentalId)

	if ("error" in detail) {
		return detail.error
	}

	return NextResponse.json(detail)
}

export async function PATCH(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "viewBookingsModule" })

	if (guard.response) {
		return guard.response
	}

	const { rentalId } = await params
	const payload = (await request.json().catch(() => null)) as
		| import("../_flow").RentalCommitPayload
		| null

	const committed = await commitRentalFlow({
		viewer: guard.viewer,
		payload,
		rentalId,
	})

	if ("error" in committed) {
		return committed.error
	}

	return NextResponse.json(committed)
}
