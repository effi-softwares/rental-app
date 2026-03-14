import { NextResponse } from "next/server"

import type { RentalAlternativeMatchMode } from "@/features/rentals/types/rental"
import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { getScopedBranchIdsForViewer } from "@/lib/authorization/server"
import { checkRentalAvailability } from "@/lib/rentals/availability"

const supportedMatchModes = new Set<RentalAlternativeMatchMode>([
	"same_class",
	"same_class_transmission",
	"same_class_price_band",
	"same_class_brand_family",
])

export async function POST(request: Request) {
	const guard = await requireViewer({ permission: "viewBookingsModule" })

	if (guard.response) {
		return guard.response
	}

	const payload = (await request.json().catch(() => null)) as {
		vehicleId?: string
		rentalId?: string | null
		startsAt?: string
		endsAt?: string
		matchMode?: RentalAlternativeMatchMode
	} | null

	const vehicleId = payload?.vehicleId?.trim()
	const startsAt = payload?.startsAt ? new Date(payload.startsAt) : null
	const endsAt = payload?.endsAt ? new Date(payload.endsAt) : null
	const matchMode = payload?.matchMode ?? "same_class"

	if (!vehicleId) {
		return jsonError("Vehicle is required.", 400)
	}

	if (
		!startsAt ||
		!endsAt ||
		Number.isNaN(startsAt.getTime()) ||
		Number.isNaN(endsAt.getTime())
	) {
		return jsonError("Valid schedule timestamps are required.", 400)
	}

	if (!supportedMatchModes.has(matchMode)) {
		return jsonError("Invalid alternative match mode.", 400)
	}

	try {
		const scopedBranchIds = await getScopedBranchIdsForViewer(guard.viewer)
		const result = await checkRentalAvailability({
			organizationId: guard.viewer.activeOrganizationId,
			vehicleId,
			startsAt,
			endsAt,
			rentalId: payload?.rentalId ?? null,
			matchMode,
			scopedBranchIds,
		})

		return NextResponse.json(result)
	} catch (error) {
		return jsonError(
			error instanceof Error
				? error.message
				: "Failed to check vehicle availability.",
			400,
		)
	}
}
