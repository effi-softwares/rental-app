import { asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { vehicleSchema } from "@/features/vehicles"
import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { viewerHasPermission } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import {
	vehicle,
	vehicleBrand,
	vehicleClass,
	vehicleModel,
	vehicleRate,
} from "@/lib/db/schema/vehicles"

type VehicleImageAsset = {
	assetId: string
	url: string
	deliveryUrl: string
	blurDataUrl: string
	sortOrder: number
}

type VehicleImages = {
	frontImages: VehicleImageAsset[]
	backImages: VehicleImageAsset[]
	interiorImages: VehicleImageAsset[]
}

type VehicleSummaryImage = {
	assetId: string
	url: string
	deliveryUrl: string
	blurDataUrl: string
}

type VehicleRateSummary = {
	vehicleId: string
	pricingModel: "Daily" | "Weekly" | "Monthly" | "Distance-Based"
	rate: string
	requiresDeposit: boolean
	depositAmount: string | null
}

const pricingModelPriority: Array<VehicleRateSummary["pricingModel"]> = [
	"Monthly",
	"Weekly",
	"Daily",
	"Distance-Based",
]

function toDateOrNull(value: string) {
	const parsed = new Date(value)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isAbsoluteHttpUrl(value: string) {
	try {
		const parsed = new URL(value)
		return parsed.protocol === "http:" || parsed.protocol === "https:"
	} catch {
		return false
	}
}

function isValidDeliveryUrl(value: string) {
	return value.startsWith("/") || isAbsoluteHttpUrl(value)
}

function normalizeFrontImageForSummary(
	images: unknown,
): VehicleSummaryImage | null {
	if (!images || typeof images !== "object") {
		return null
	}

	const frontImages = (images as { frontImages?: unknown }).frontImages
	if (!Array.isArray(frontImages)) {
		return null
	}

	const normalized = frontImages
		.filter((entry) => entry && typeof entry === "object")
		.map((entry, index) => {
			const image = entry as {
				assetId?: unknown
				url?: unknown
				deliveryUrl?: unknown
				blurDataUrl?: unknown
				sortOrder?: unknown
			}

			if (
				typeof image.assetId !== "string" ||
				image.assetId.length === 0 ||
				typeof image.url !== "string" ||
				image.url.length === 0 ||
				typeof image.deliveryUrl !== "string" ||
				!isValidDeliveryUrl(image.deliveryUrl) ||
				typeof image.blurDataUrl !== "string" ||
				image.blurDataUrl.length === 0
			) {
				return null
			}

			const sortOrder =
				typeof image.sortOrder === "number" && Number.isFinite(image.sortOrder)
					? Math.max(0, Math.floor(image.sortOrder))
					: index

			return {
				assetId: image.assetId,
				url: image.url,
				deliveryUrl: image.deliveryUrl,
				blurDataUrl: image.blurDataUrl,
				sortOrder,
			}
		})
		.filter((entry): entry is VehicleSummaryImage & { sortOrder: number } =>
			Boolean(entry),
		)
		.sort((left, right) => left.sortOrder - right.sortOrder)

	const first = normalized[0]
	if (!first) {
		return null
	}

	return {
		assetId: first.assetId,
		url: first.url,
		deliveryUrl: first.deliveryUrl,
		blurDataUrl: first.blurDataUrl,
	}
}

function normalizeImagesForWrite(images: VehicleImages): VehicleImages {
	function normalizeGroup(assets: VehicleImageAsset[]) {
		return [...assets]
			.sort((left, right) => left.sortOrder - right.sortOrder)
			.map((asset, index) => ({ ...asset, sortOrder: index }))
	}

	return {
		frontImages: normalizeGroup(images.frontImages),
		backImages: normalizeGroup(images.backImages),
		interiorImages: normalizeGroup(images.interiorImages),
	}
}

function pickPrimaryRateForSummary(rates: VehicleRateSummary[]) {
	for (const pricingModel of pricingModelPriority) {
		const found = rates.find((rate) => rate.pricingModel === pricingModel)
		if (!found) {
			continue
		}

		return {
			pricingModel: found.pricingModel,
			rate: Number(found.rate),
			requiresDeposit: found.requiresDeposit,
			depositAmount:
				found.depositAmount === null ? null : Number(found.depositAmount),
		}
	}

	return null
}

function mapVehicleWriteError(error: unknown) {
	if (!error || typeof error !== "object") {
		return null
	}

	const code = "code" in error ? String(error.code) : ""
	const constraint = "constraint" in error ? String(error.constraint) : ""

	if (code !== "23505") {
		if (code === "23503") {
			if (constraint === "vehicle_vehicle_class_id_vehicle_class_id_fk") {
				return jsonError("Selected vehicle class is invalid.", 400)
			}

			if (constraint === "vehicle_brand_id_vehicle_brand_id_fk") {
				return jsonError("Selected brand is invalid.", 400)
			}

			if (constraint === "vehicle_model_id_vehicle_model_id_fk") {
				return jsonError("Selected model is invalid.", 400)
			}

			if (constraint === "vehicle_body_type_id_vehicle_type_id_fk") {
				return jsonError("Selected body type is invalid.", 400)
			}

			if (constraint === "vehicle_branch_id_branch_id_fk") {
				return jsonError("Selected branch is invalid.", 400)
			}

			return jsonError("One or more selected references are invalid.", 400)
		}

		if (code === "22P02") {
			return jsonError("Invalid input format for one or more fields.", 400)
		}

		return null
	}

	if (constraint === "vehicle_organization_vin_uidx") {
		return jsonError(
			"A vehicle with this VIN already exists in the active organization.",
			409,
		)
	}

	if (constraint === "vehicle_organization_license_uidx") {
		return jsonError(
			"A vehicle with this license plate already exists in the active organization.",
			409,
		)
	}

	return null
}

export async function GET() {
	const guard = await requireViewer({ permission: "viewFleetModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const canManageVehicles = await viewerHasPermission(viewer, "manageVehicles")

	const vehicles = await db
		.select({
			id: vehicle.id,
			branchId: vehicle.branchId,
			vehicleClassId: vehicle.vehicleClassId,
			vehicleClassName: vehicleClass.name,
			vehicleClassCode: vehicleClass.code,
			brandName: vehicleBrand.name,
			modelName: vehicleModel.name,
			bodyTypeId: vehicle.bodyTypeId,
			year: vehicle.year,
			licensePlate: vehicle.licensePlate,
			status: vehicle.status,
			fuelType: vehicle.fuelType,
			transmission: vehicle.transmission,
			seats: vehicle.seats,
			images: vehicle.images,
			createdAt: vehicle.createdAt,
		})
		.from(vehicle)
		.innerJoin(vehicleBrand, eq(vehicle.brandId, vehicleBrand.id))
		.innerJoin(vehicleModel, eq(vehicle.modelId, vehicleModel.id))
		.leftJoin(vehicleClass, eq(vehicle.vehicleClassId, vehicleClass.id))
		.where(eq(vehicle.organizationId, viewer.activeOrganizationId))
		.orderBy(asc(vehicle.createdAt))

	const rateRows = await db
		.select({
			vehicleId: vehicleRate.vehicleId,
			pricingModel: vehicleRate.pricingModel,
			rate: vehicleRate.rate,
			requiresDeposit: vehicleRate.requiresDeposit,
			depositAmount: vehicleRate.depositAmount,
		})
		.from(vehicleRate)
		.where(eq(vehicleRate.organizationId, viewer.activeOrganizationId))

	const ratesByVehicle = rateRows.reduce<Map<string, VehicleRateSummary[]>>(
		(accumulator, row) => {
			const collection = accumulator.get(row.vehicleId) ?? []
			collection.push(row)
			accumulator.set(row.vehicleId, collection)
			return accumulator
		},
		new Map(),
	)

	return NextResponse.json({
		vehicles: vehicles.map((row) => {
			const { images, ...summary } = row
			const rateCollection = ratesByVehicle.get(row.id) ?? []

			return {
				...summary,
				frontImage: normalizeFrontImageForSummary(images),
				primaryRate: pickPrimaryRateForSummary(rateCollection),
				rates: rateCollection.map((rate) => ({
					pricingModel: rate.pricingModel,
					rate: Number(rate.rate),
					requiresDeposit: rate.requiresDeposit,
					depositAmount:
						rate.depositAmount === null ? null : Number(rate.depositAmount),
				})),
				createdAt: row.createdAt.toISOString(),
			}
		}),
		canManageVehicles,
	})
}

export async function POST(request: Request) {
	const guard = await requireViewer({ permission: "manageVehicles" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const payload = await request.json().catch(() => null)
	const parsed = vehicleSchema.safeParse(payload)

	if (!parsed.success) {
		return jsonError(
			parsed.error.issues[0]?.message ?? "Invalid vehicle payload.",
			400,
		)
	}

	const input = parsed.data
	const normalizedImages = normalizeImagesForWrite(input.images)
	const registrationExpiryDate = toDateOrNull(
		input.operations.registrationExpiryDate,
	)
	const insuranceExpiryDate = toDateOrNull(input.operations.insuranceExpiryDate)

	if (!registrationExpiryDate || !insuranceExpiryDate) {
		return jsonError("Invalid registration or insurance expiry date.", 400)
	}

	try {
		const [created] = await db
			.insert(vehicle)
			.values({
				organizationId: viewer.activeOrganizationId,
				brandId: input.identity.brandId,
				modelId: input.identity.modelId,
				vehicleClassId: input.identity.vehicleClassId ?? null,
				bodyTypeId: input.identity.bodyTypeId ?? null,
				year: input.identity.year,
				vin: input.identity.vin.toUpperCase(),
				licensePlate: input.identity.licensePlate,
				color: input.identity.color,
				isBrandNew: input.identity.isBrandNew,
				transmission: input.specs.transmission,
				fuelType: input.specs.fuelType,
				drivetrain: input.specs.drivetrain,
				seats: input.specs.seats,
				doors: input.specs.doors,
				baggageCapacity: input.specs.baggageCapacity,
				hasAc: input.specs.features.hasAC,
				hasNavigation: input.specs.features.hasNavigation,
				hasBluetooth: input.specs.features.hasBluetooth,
				isPetFriendly: input.specs.features.isPetFriendly,
				status: input.operations.status,
				registrationExpiryDate,
				insuranceExpiryDate,
				insurancePolicyNumber: input.operations.insurancePolicyNumber,
				images: normalizedImages,
			})
			.returning({ id: vehicle.id })

		if (!created?.id) {
			return jsonError("Failed to create vehicle.", 500)
		}

		if (input.rates.rates.length > 0) {
			await db.insert(vehicleRate).values(
				input.rates.rates.map((rate) => {
					const mileagePolicy = rate.mileagePolicy
					const isLimited = mileagePolicy.mileageType === "Limited"

					return {
						organizationId: viewer.activeOrganizationId,
						vehicleId: created.id,
						pricingModel: rate.pricingModel,
						rate: String(rate.rate),
						mileageType: mileagePolicy.mileageType,
						limitPerDay:
							mileagePolicy.mileageType === "Limited"
								? mileagePolicy.limitPerDay
								: null,
						overageFeePerUnit: isLimited
							? String(mileagePolicy.overageFeePerUnit)
							: null,
						measureUnit: isLimited ? mileagePolicy.measureUnit : null,
						requiresDeposit: rate.requiresDeposit,
						depositAmount:
							rate.requiresDeposit && rate.depositAmount !== undefined
								? String(rate.depositAmount)
								: null,
					}
				}),
			)
		}

		return NextResponse.json({ id: created.id }, { status: 201 })
	} catch (error) {
		console.log(error)

		const conflictResponse = mapVehicleWriteError(error)
		if (conflictResponse) {
			return conflictResponse
		}

		return jsonError("Failed to create vehicle.", 500)
	}
}
