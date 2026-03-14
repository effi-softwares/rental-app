import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { requireStripeServer } from "@/lib/stripe/server"
import { getScopedRentalForViewer, logRentalEvent } from "../../../_lib"

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

	const payload = (await request.json().catch(() => ({}))) as {
		readerId?: string
		setupIntentId?: string
	}

	const readerId = payload.readerId?.trim()
	const setupIntentId = payload.setupIntentId?.trim()

	if (!readerId || !setupIntentId) {
		return jsonError("Reader id and setup intent id are required.", 400)
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
	const reader = await stripe.terminal.readers.processSetupIntent(readerId, {
		setup_intent: setupIntentId,
		allow_redisplay: "always",
		process_config: {
			enable_customer_cancellation: true,
		},
	})

	await logRentalEvent({
		viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.terminal.setup_started",
		payload: {
			readerId,
			setupIntentId,
			locationId: terminalLocationId,
			readerActionType: reader.action?.type ?? null,
		},
	})

	return NextResponse.json({
		reader: {
			id: reader.id,
			label: reader.label,
			status: reader.status,
			actionType: reader.action?.type ?? null,
		},
	})
}
