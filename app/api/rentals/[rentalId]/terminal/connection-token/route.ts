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

export async function POST(_: Request, { params }: RouteProps) {
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
		return jsonError(
			"This branch does not have a Stripe Terminal location configured.",
			400,
		)
	}

	const stripe = requireStripeServer()
	const token = await stripe.terminal.connectionTokens.create({
		location: terminalLocationId,
	})

	return NextResponse.json({
		secret: token.secret,
		locationId: terminalLocationId,
	})
}
