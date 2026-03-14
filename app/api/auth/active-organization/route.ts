import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import {
	getAccessibleOrganizationIdsForUser,
	syncCanonicalActiveOrganizationForUser,
} from "@/lib/authorization/active-organization"

const requestSchema = z.object({
	organizationId: z.string().uuid().nullable(),
})

export async function POST(request: Request) {
	const viewerResult = await requireViewer({ requireActiveOrganization: false })

	if (viewerResult.response) {
		return viewerResult.response
	}

	const payload = await request.json().catch(() => null)
	const parsed = requestSchema.safeParse(payload)

	if (!parsed.success) {
		return jsonError("Invalid active organization payload.", 400)
	}

	const accessibleOrganizationIds = await getAccessibleOrganizationIdsForUser(
		viewerResult.viewer.userId,
	)
	const requestedOrganizationId = parsed.data.organizationId

	if (!requestedOrganizationId && accessibleOrganizationIds.length > 0) {
		return jsonError(
			"An accessible organization must be selected for this user.",
			400,
		)
	}

	if (
		requestedOrganizationId &&
		!accessibleOrganizationIds.includes(requestedOrganizationId)
	) {
		return jsonError("Organization is not accessible to this user.", 403)
	}

	await syncCanonicalActiveOrganizationForUser(
		viewerResult.viewer.userId,
		requestedOrganizationId,
	)

	return NextResponse.json({
		activeOrganizationId: requestedOrganizationId,
	})
}
