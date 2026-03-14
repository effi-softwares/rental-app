import { and, desc, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { getScopedBranchIdsForViewer } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { customer } from "@/lib/db/schema/customers"
import { rental } from "@/lib/db/schema/rentals"
import { vehicle, vehicleBrand, vehicleModel } from "@/lib/db/schema/vehicles"
import { commitRentalFlow } from "./_flow"

const allowedStatuses = new Set([
	"draft",
	"awaiting_payment",
	"scheduled",
	"active",
	"completed",
	"cancelled",
])

export async function GET(request: Request) {
	const guard = await requireViewer({ permission: "viewBookingsModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)

	if (scopedBranchIds && scopedBranchIds.length === 0) {
		return NextResponse.json({ rentals: [] })
	}

	const url = new URL(request.url)
	const statusFilterParam = url.searchParams.get("status")
	const statusFilters = (statusFilterParam ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter((value) => allowedStatuses.has(value)) as Array<
		typeof rental.$inferSelect.status
	>

	const rows = await db
		.select({
			id: rental.id,
			status: rental.status,
			paymentPlanKind: rental.paymentPlanKind,
			firstCollectionTiming: rental.firstCollectionTiming,
			installmentInterval: rental.installmentInterval,
			selectedPaymentMethodType: rental.selectedPaymentMethodType,
			recurringBillingState: rental.recurringBillingState,
			storedPaymentMethodStatus: rental.storedPaymentMethodStatus,
			plannedStartAt: rental.plannedStartAt,
			plannedEndAt: rental.plannedEndAt,
			actualStartAt: rental.actualStartAt,
			actualEndAt: rental.actualEndAt,
			createdAt: rental.createdAt,
			updatedAt: rental.updatedAt,
			vehicleId: rental.vehicleId,
			vehicleYear: vehicle.year,
			vehiclePlate: vehicle.licensePlate,
			vehicleBrand: vehicleBrand.name,
			vehicleModel: vehicleModel.name,
			customerId: rental.customerId,
			customerName: customer.fullName,
			customerEmail: customer.email,
			customerPhone: customer.phone,
		})
		.from(rental)
		.leftJoin(vehicle, eq(rental.vehicleId, vehicle.id))
		.leftJoin(vehicleBrand, eq(vehicle.brandId, vehicleBrand.id))
		.leftJoin(vehicleModel, eq(vehicle.modelId, vehicleModel.id))
		.leftJoin(customer, eq(rental.customerId, customer.id))
		.where(
			and(
				eq(rental.organizationId, viewer.activeOrganizationId),
				scopedBranchIds === null
					? undefined
					: inArray(rental.branchId, scopedBranchIds),
				statusFilters.length > 0
					? inArray(rental.status, statusFilters)
					: undefined,
			),
		)
		.orderBy(desc(rental.createdAt))

	return NextResponse.json({
		rentals: rows.map((row) => ({
			id: row.id,
			status: row.status,
			paymentPlanKind: row.paymentPlanKind,
			firstCollectionTiming: row.firstCollectionTiming,
			installmentInterval: row.installmentInterval,
			selectedPaymentMethodType: row.selectedPaymentMethodType,
			recurringBillingState: row.recurringBillingState,
			storedPaymentMethodStatus: row.storedPaymentMethodStatus,
			plannedStartAt: row.plannedStartAt?.toISOString() ?? null,
			plannedEndAt: row.plannedEndAt?.toISOString() ?? null,
			actualStartAt: row.actualStartAt?.toISOString() ?? null,
			actualEndAt: row.actualEndAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			vehicle: row.vehicleId
				? {
						id: row.vehicleId,
						label:
							row.vehicleYear && row.vehicleBrand && row.vehicleModel
								? `${row.vehicleYear} ${row.vehicleBrand} ${row.vehicleModel}`
								: "Vehicle",
						licensePlate: row.vehiclePlate,
					}
				: null,
			customer: row.customerId
				? {
						id: row.customerId,
						fullName: row.customerName,
						email: row.customerEmail,
						phone: row.customerPhone,
					}
				: null,
		})),
	})
}

export async function POST(request: Request) {
	const guard = await requireViewer({ permission: "viewBookingsModule" })

	if (guard.response) {
		return guard.response
	}

	const payload = (await request.json().catch(() => null)) as
		| import("./_flow").RentalCommitPayload
		| null

	const committed = await commitRentalFlow({
		viewer: guard.viewer,
		payload,
	})

	if ("error" in committed) {
		return committed.error
	}

	return NextResponse.json(committed, { status: 201 })
}
