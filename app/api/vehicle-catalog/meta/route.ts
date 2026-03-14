import { asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { viewerHasPermission } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import {
	vehicleBrand,
	vehicleClass,
	vehicleModel,
	vehicleType,
} from "@/lib/db/schema/vehicles"

export async function GET() {
	const guard = await requireViewer({ permission: "viewFleetModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const canManageVehicles = await viewerHasPermission(viewer, "manageVehicles")

	const [vehicleClasses, brands, models, bodyTypes] = await Promise.all([
		db
			.select({
				id: vehicleClass.id,
				name: vehicleClass.name,
				code: vehicleClass.code,
				description: vehicleClass.description,
				bodyTypeId: vehicleClass.bodyTypeId,
			})
			.from(vehicleClass)
			.where(eq(vehicleClass.organizationId, viewer.activeOrganizationId))
			.orderBy(asc(vehicleClass.name)),
		db
			.select({
				id: vehicleBrand.id,
				name: vehicleBrand.name,
				country: vehicleBrand.country,
			})
			.from(vehicleBrand)
			.orderBy(asc(vehicleBrand.name)),
		db
			.select({
				id: vehicleModel.id,
				brandId: vehicleModel.brandId,
				name: vehicleModel.name,
				bodyTypeId: vehicleModel.bodyTypeId,
			})
			.from(vehicleModel)
			.orderBy(asc(vehicleModel.name)),
		db
			.select({ id: vehicleType.id, name: vehicleType.name })
			.from(vehicleType)
			.orderBy(asc(vehicleType.name)),
	])

	return NextResponse.json({
		vehicleClasses,
		brands,
		models,
		bodyTypes,
		canManageVehicles,
	})
}
