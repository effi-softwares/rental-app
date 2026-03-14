import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { getAccessibleOrganizationsForUser } from "@/lib/authorization/server"

export async function GET() {
	const viewerResult = await requireViewer({ requireActiveOrganization: false })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const organizations = await getAccessibleOrganizationsForUser(
		viewerResult.viewer.userId,
	)

	return NextResponse.json({ organizations })
}
