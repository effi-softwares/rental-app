import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { vehicleSchema } from "@/features/vehicles"
import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import {
	vehicle,
	vehicleBrand,
	vehicleClass,
	vehicleModel,
	vehicleRate,
	vehicleType,
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

function normalizeImageArray(value: unknown) {
	if (!Array.isArray(value)) {
		return [] as VehicleImageAsset[]
	}

	const normalized: VehicleImageAsset[] = []

	for (const [index, entry] of value.entries()) {
		if (!entry || typeof entry !== "object") {
			continue
		}

		const assetId =
			typeof entry.assetId === "string" && entry.assetId.length > 0
				? entry.assetId
				: null
		const url =
			typeof entry.url === "string" && entry.url.length > 0 ? entry.url : null
		const deliveryUrl =
			typeof entry.deliveryUrl === "string" && entry.deliveryUrl.length > 0
				? entry.deliveryUrl
				: null
		const blurDataUrl =
			typeof entry.blurDataUrl === "string" && entry.blurDataUrl.length > 0
				? entry.blurDataUrl
				: null

		if (
			!assetId ||
			!url ||
			!deliveryUrl ||
			!isValidDeliveryUrl(deliveryUrl) ||
			!blurDataUrl
		) {
			continue
		}

		const sortOrder =
			typeof entry.sortOrder === "number" && Number.isFinite(entry.sortOrder)
				? Math.max(0, Math.floor(entry.sortOrder))
				: index

		const image: VehicleImageAsset = {
			assetId,
			url,
			deliveryUrl,
			blurDataUrl,
			sortOrder,
		}

		normalized.push(image)
	}

	return normalized
		.sort((left, right) => left.sortOrder - right.sortOrder)
		.map((asset, index) => ({ ...asset, sortOrder: index }))
}

function normalizeImagesForRead(images: unknown) {
	const source =
		images && typeof images === "object"
			? (images as {
					frontImages?: unknown
					backImages?: unknown
					interiorImages?: unknown
				})
			: {}

	const frontImages = normalizeImageArray(source.frontImages)
	const backImages = normalizeImageArray(source.backImages)
	const interiorImages = normalizeImageArray(source.interiorImages)

	return {
		frontImages,
		backImages,
		interiorImages,
	} satisfies VehicleImages
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

type Params = {
	params: Promise<{ vehicleId: string }>
}

export async function GET(_: Request, { params }: Params) {
	const guard = await requireViewer({ permission: "viewFleetModule" })

	if (guard.response) {
		return guard.response
	}

	const { vehicleId } = await params
	const viewer = guard.viewer

	const rows = await db
		.select({
			id: vehicle.id,
			organizationId: vehicle.organizationId,
			branchId: vehicle.branchId,
			vehicleClassId: vehicle.vehicleClassId,
			vehicleClassName: vehicleClass.name,
			vehicleClassCode: vehicleClass.code,
			brandId: vehicle.brandId,
			brandName: vehicleBrand.name,
			modelId: vehicle.modelId,
			modelName: vehicleModel.name,
			bodyTypeId: vehicle.bodyTypeId,
			bodyTypeName: vehicleType.name,
			year: vehicle.year,
			vin: vehicle.vin,
			licensePlate: vehicle.licensePlate,
			color: vehicle.color,
			isBrandNew: vehicle.isBrandNew,
			transmission: vehicle.transmission,
			fuelType: vehicle.fuelType,
			drivetrain: vehicle.drivetrain,
			seats: vehicle.seats,
			doors: vehicle.doors,
			baggageCapacity: vehicle.baggageCapacity,
			hasAc: vehicle.hasAc,
			hasNavigation: vehicle.hasNavigation,
			hasBluetooth: vehicle.hasBluetooth,
			isPetFriendly: vehicle.isPetFriendly,
			status: vehicle.status,
			registrationExpiryDate: vehicle.registrationExpiryDate,
			insuranceExpiryDate: vehicle.insuranceExpiryDate,
			insurancePolicyNumber: vehicle.insurancePolicyNumber,
			images: vehicle.images,
			createdAt: vehicle.createdAt,
			updatedAt: vehicle.updatedAt,
		})
		.from(vehicle)
		.innerJoin(vehicleBrand, eq(vehicle.brandId, vehicleBrand.id))
		.innerJoin(vehicleModel, eq(vehicle.modelId, vehicleModel.id))
		.leftJoin(vehicleClass, eq(vehicle.vehicleClassId, vehicleClass.id))
		.leftJoin(vehicleType, eq(vehicle.bodyTypeId, vehicleType.id))
		.where(
			and(
				eq(vehicle.id, vehicleId),
				eq(vehicle.organizationId, viewer.activeOrganizationId),
			),
		)

	const record = rows[0]

	if (!record) {
		return jsonError("Vehicle not found.", 404)
	}

	const rates = await db
		.select({
			id: vehicleRate.id,
			pricingModel: vehicleRate.pricingModel,
			rate: vehicleRate.rate,
			mileageType: vehicleRate.mileageType,
			limitPerDay: vehicleRate.limitPerDay,
			overageFeePerUnit: vehicleRate.overageFeePerUnit,
			measureUnit: vehicleRate.measureUnit,
			requiresDeposit: vehicleRate.requiresDeposit,
			depositAmount: vehicleRate.depositAmount,
		})
		.from(vehicleRate)
		.where(
			and(
				eq(vehicleRate.vehicleId, vehicleId),
				eq(vehicleRate.organizationId, viewer.activeOrganizationId),
			),
		)

	const normalizedImages = normalizeImagesForRead(record.images)

	return NextResponse.json({
		...record,
		images: normalizedImages,
		registrationExpiryDate: record.registrationExpiryDate.toISOString(),
		insuranceExpiryDate: record.insuranceExpiryDate.toISOString(),
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
		rates: rates.map((rate) => ({
			...rate,
			rate: Number(rate.rate),
			overageFeePerUnit:
				rate.overageFeePerUnit === null ? null : Number(rate.overageFeePerUnit),
			depositAmount:
				rate.depositAmount === null ? null : Number(rate.depositAmount),
		})),
	})
}

export async function PATCH(request: Request, { params }: Params) {
	const guard = await requireViewer({ permission: "manageVehicles" })

	if (guard.response) {
		return guard.response
	}

	const { vehicleId } = await params
	const viewer = guard.viewer
	const payload = await request.json().catch(() => null)

	const current = await db
		.select({ id: vehicle.id })
		.from(vehicle)
		.where(
			and(
				eq(vehicle.id, vehicleId),
				eq(vehicle.organizationId, viewer.activeOrganizationId),
			),
		)
		.limit(1)

	if (!current[0]) {
		return jsonError("Vehicle not found.", 404)
	}

	if (
		payload &&
		typeof payload === "object" &&
		"operations" in payload &&
		payload.operations &&
		typeof payload.operations === "object" &&
		"status" in payload.operations
	) {
		const nextStatus = (payload.operations as { status?: string }).status

		if (!nextStatus) {
			return jsonError("Status is required.", 400)
		}

		await db
			.update(vehicle)
			.set({
				status: nextStatus as (typeof vehicle.$inferInsert)["status"],
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(vehicle.id, vehicleId),
					eq(vehicle.organizationId, viewer.activeOrganizationId),
				),
			)

		return NextResponse.json({ ok: true })
	}

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
		await db
			.update(vehicle)
			.set({
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
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(vehicle.id, vehicleId),
					eq(vehicle.organizationId, viewer.activeOrganizationId),
				),
			)

		await db
			.delete(vehicleRate)
			.where(
				and(
					eq(vehicleRate.vehicleId, vehicleId),
					eq(vehicleRate.organizationId, viewer.activeOrganizationId),
				),
			)

		if (input.rates.rates.length > 0) {
			await db.insert(vehicleRate).values(
				input.rates.rates.map((rate) => {
					const mileagePolicy = rate.mileagePolicy
					const isLimited = mileagePolicy.mileageType === "Limited"

					return {
						organizationId: viewer.activeOrganizationId,
						vehicleId,
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

		return NextResponse.json({ ok: true })
	} catch (error) {
		const conflictResponse = mapVehicleWriteError(error)
		if (conflictResponse) {
			return conflictResponse
		}

		return jsonError("Failed to update vehicle.", 500)
	}
}

export async function DELETE(_: Request, { params }: Params) {
	const guard = await requireViewer({ permission: "manageVehicles" })

	if (guard.response) {
		return guard.response
	}

	const { vehicleId } = await params
	const viewer = guard.viewer

	await db
		.delete(vehicle)
		.where(
			and(
				eq(vehicle.id, vehicleId),
				eq(vehicle.organizationId, viewer.activeOrganizationId),
			),
		)

	return NextResponse.json({ ok: true })
}
