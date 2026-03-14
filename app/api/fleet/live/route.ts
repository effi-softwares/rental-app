import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { isPrivilegedFleetViewerRole } from "@/lib/authorization/server"
import { getFleetLiveResponse } from "@/lib/fleet/server"

export async function GET() {
	const guard = await requireViewer({ permission: "viewFleetModule" })

	if (guard.response) {
		return guard.response
	}

	if (!isPrivilegedFleetViewerRole(guard.viewer.role)) {
		return NextResponse.json({ error: "Forbidden." }, { status: 403 })
	}

	const payload = await getFleetLiveResponse(guard.viewer.activeOrganizationId)
	return NextResponse.json(payload)
}
