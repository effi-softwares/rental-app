import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { isPrivilegedFleetViewerRole } from "@/lib/authorization/server"
import { getFleetVehicleLiveDetail } from "@/lib/fleet/server"

type Params = {
	params: Promise<{ vehicleId: string }>
}

export async function GET(request: Request, { params }: Params) {
	const guard = await requireViewer({ permission: "viewFleetModule" })

	if (guard.response) {
		return guard.response
	}

	if (!isPrivilegedFleetViewerRole(guard.viewer.role)) {
		return NextResponse.json({ error: "Forbidden." }, { status: 403 })
	}

	const { vehicleId } = await params
	const url = new URL(request.url)
	const requestedHours = Number(url.searchParams.get("hours") ?? "1")
	const hours = Number.isFinite(requestedHours)
		? Math.min(Math.max(requestedHours, 1), 24)
		: 1

	const payload = await getFleetVehicleLiveDetail(
		guard.viewer.activeOrganizationId,
		vehicleId,
		hours,
	)

	if (!payload.vehicle) {
		return jsonError("Vehicle not found.", 404)
	}

	return NextResponse.json(payload)
}
