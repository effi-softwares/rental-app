import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { requireStripeServer } from "@/lib/stripe/server"
import { getScopedRentalForViewer } from "../../../_lib"

type RouteProps = {
	params: Promise<{
		rentalId: string
	}>
}

export async function GET(_: Request, { params }: RouteProps) {
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

	if (!scopedRental.record.branchId) {
		return jsonError("Rental branch is required for Terminal access.", 400)
	}

	const branchRows = await db
		.select({
			stripeTerminalLocationId: branch.stripeTerminalLocationId,
		})
		.from(branch)
		.where(
			and(
				eq(branch.organizationId, viewer.activeOrganizationId),
				eq(branch.id, scopedRental.record.branchId),
			),
		)
		.limit(1)

	const terminalLocationId = branchRows[0]?.stripeTerminalLocationId
	if (!terminalLocationId) {
		return NextResponse.json({ readers: [], locationId: null })
	}

	const stripe = requireStripeServer()
	const readers = await stripe.terminal.readers.list({
		location: terminalLocationId,
		limit: 20,
	})

	return NextResponse.json({
		locationId: terminalLocationId,
		readers: readers.data.map((reader) => ({
			id: reader.id,
			label: reader.label,
			serialNumber: reader.serial_number,
			deviceType: reader.device_type,
			status: reader.status,
			actionType: reader.action?.type ?? null,
			locationId:
				typeof reader.location === "string"
					? reader.location
					: (reader.location?.id ?? null),
		})),
	})
}
