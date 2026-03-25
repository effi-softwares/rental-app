import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { CUSTOMER_STATUSES } from "@/features/customers/constants"
import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { customer } from "@/lib/db/schema/customers"
import { resolveVisibleCustomer } from "../../_lib"

type RouteProps = {
	params: Promise<{
		customerId: string
	}>
}

export async function PATCH(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "manageCustomers" })

	if (guard.response) {
		return guard.response
	}

	const { customerId } = await params
	const target = await resolveVisibleCustomer({
		viewer: guard.viewer,
		customerId,
	})

	if (target.response) {
		return target.response
	}

	const payload = (await request.json().catch(() => null)) as {
		status?: string
	} | null

	const nextStatus = payload?.status?.trim()
	if (
		!CUSTOMER_STATUSES.includes(
			nextStatus as (typeof CUSTOMER_STATUSES)[number],
		)
	) {
		return jsonError("Invalid customer status.", 400)
	}

	await db
		.update(customer)
		.set({
			status: nextStatus,
			bannedAt: nextStatus === "banned" ? new Date() : null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(customer.organizationId, guard.viewer.activeOrganizationId),
				eq(customer.id, customerId),
			),
		)

	return NextResponse.json({ success: true })
}
