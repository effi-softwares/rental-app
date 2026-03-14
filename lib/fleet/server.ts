import { and, asc, desc, eq, gte, inArray } from "drizzle-orm"

import type {
	FleetLiveResponse,
	FleetLiveSnapshot,
	FleetLiveVehicleListItem,
	FleetVehicleLiveDetailResponse,
} from "@/features/fleet/types/fleet"
import { db } from "@/lib/db"
import { customer } from "@/lib/db/schema/customers"
import {
	vehicleLivePosition,
	vehiclePositionHistory,
	vehicleTrackingDevice,
} from "@/lib/db/schema/fleet"
import { rental } from "@/lib/db/schema/rentals"
import { vehicle, vehicleBrand, vehicleModel } from "@/lib/db/schema/vehicles"
import {
	deriveFleetTelemetryStatus,
	getFleetViewportDefaults,
	getFreshnessSeconds,
} from "./live"

type VehicleImageAsset = {
	assetId?: unknown
	deliveryUrl?: unknown
	blurDataUrl?: unknown
	sortOrder?: unknown
}

function pickFrontImage(images: unknown) {
	if (!images || typeof images !== "object") {
		return null
	}

	const frontImages = (images as { frontImages?: VehicleImageAsset[] })
		.frontImages
	if (!Array.isArray(frontImages)) {
		return null
	}

	const first = [...frontImages]
		.filter((entry) => entry && typeof entry === "object")
		.sort((left, right) => {
			const leftOrder =
				typeof left.sortOrder === "number"
					? left.sortOrder
					: Number.MAX_SAFE_INTEGER
			const rightOrder =
				typeof right.sortOrder === "number"
					? right.sortOrder
					: Number.MAX_SAFE_INTEGER
			return leftOrder - rightOrder
		})[0]

	if (
		!first ||
		typeof first.assetId !== "string" ||
		typeof first.deliveryUrl !== "string" ||
		typeof first.blurDataUrl !== "string"
	) {
		return null
	}

	return {
		assetId: first.assetId,
		deliveryUrl: first.deliveryUrl,
		blurDataUrl: first.blurDataUrl,
	}
}

function serializeSnapshot(input: {
	latitude: number
	longitude: number
	speedKph: number | null
	heading: number | null
	accuracyMeters: number | null
	recordedAt: Date
	receivedAt: Date
	source: "mock" | "traccar"
}): FleetLiveSnapshot {
	return {
		latitude: input.latitude,
		longitude: input.longitude,
		speedKph: input.speedKph,
		heading: input.heading,
		accuracyMeters: input.accuracyMeters,
		recordedAt: input.recordedAt.toISOString(),
		receivedAt: input.receivedAt.toISOString(),
		source: input.source,
		freshnessSeconds: getFreshnessSeconds(input.recordedAt),
	}
}

const liveStatusSortOrder = {
	moving: 0,
	parked: 1,
	offline: 2,
	no_data: 3,
} as const

function buildVehicleLabel(row: {
	year: number
	brandName: string
	modelName: string
}) {
	return `${row.year} ${row.brandName} ${row.modelName}`
}

export async function getFleetLiveResponse(
	organizationId: string,
): Promise<FleetLiveResponse> {
	const [vehicleRows, liveRows, rentalRows] = await Promise.all([
		db
			.select({
				id: vehicle.id,
				brandName: vehicleBrand.name,
				modelName: vehicleModel.name,
				year: vehicle.year,
				licensePlate: vehicle.licensePlate,
				status: vehicle.status,
				images: vehicle.images,
			})
			.from(vehicle)
			.innerJoin(vehicleBrand, eq(vehicle.brandId, vehicleBrand.id))
			.innerJoin(vehicleModel, eq(vehicle.modelId, vehicleModel.id))
			.where(eq(vehicle.organizationId, organizationId)),
		db
			.select({
				vehicleId: vehicleLivePosition.vehicleId,
				latitude: vehicleLivePosition.latitude,
				longitude: vehicleLivePosition.longitude,
				speedKph: vehicleLivePosition.speedKph,
				heading: vehicleLivePosition.heading,
				accuracyMeters: vehicleLivePosition.accuracyMeters,
				recordedAt: vehicleLivePosition.recordedAt,
				receivedAt: vehicleLivePosition.receivedAt,
				source: vehicleLivePosition.source,
				deviceId: vehicleTrackingDevice.id,
				deviceDisplayName: vehicleTrackingDevice.displayName,
				deviceProvider: vehicleTrackingDevice.provider,
				externalDeviceId: vehicleTrackingDevice.externalDeviceId,
			})
			.from(vehicleLivePosition)
			.leftJoin(
				vehicleTrackingDevice,
				eq(vehicleLivePosition.deviceId, vehicleTrackingDevice.id),
			)
			.where(eq(vehicleLivePosition.organizationId, organizationId)),
		db
			.select({
				id: rental.id,
				vehicleId: rental.vehicleId,
				status: rental.status,
				plannedStartAt: rental.plannedStartAt,
				plannedEndAt: rental.plannedEndAt,
				customerName: customer.fullName,
			})
			.from(rental)
			.leftJoin(customer, eq(rental.customerId, customer.id))
			.where(
				and(
					eq(rental.organizationId, organizationId),
					inArray(rental.status, ["scheduled", "active"]),
				),
			)
			.orderBy(desc(rental.updatedAt)),
	])

	const liveByVehicle = new Map(liveRows.map((row) => [row.vehicleId, row]))
	const rentalByVehicle = new Map<
		string,
		{
			id: string
			status: "scheduled" | "active"
			customerName: string | null
			plannedStartAt: Date | null
			plannedEndAt: Date | null
		}
	>()

	for (const row of rentalRows) {
		if (!row.vehicleId) {
			continue
		}

		const existing = rentalByVehicle.get(row.vehicleId)
		if (existing?.status === "active") {
			continue
		}

		rentalByVehicle.set(row.vehicleId, {
			id: row.id,
			status: row.status as "scheduled" | "active",
			customerName: row.customerName,
			plannedStartAt: row.plannedStartAt,
			plannedEndAt: row.plannedEndAt,
		})
	}

	const vehicles = vehicleRows
		.map<FleetLiveVehicleListItem>((row) => {
			const liveRow = liveByVehicle.get(row.id)
			const activeRental = rentalByVehicle.get(row.id) ?? null
			const telemetryStatus = deriveFleetTelemetryStatus({
				recordedAt: liveRow?.recordedAt ?? null,
				speedKph: liveRow?.speedKph ?? null,
			})

			return {
				id: row.id,
				label: buildVehicleLabel(row),
				licensePlate: row.licensePlate,
				brandName: row.brandName,
				modelName: row.modelName,
				year: row.year,
				status: row.status,
				telemetryStatus,
				isRentedNow: Boolean(activeRental || row.status === "Rented"),
				frontImage: pickFrontImage(row.images),
				snapshot: liveRow
					? serializeSnapshot({
							latitude: liveRow.latitude,
							longitude: liveRow.longitude,
							speedKph: liveRow.speedKph,
							heading: liveRow.heading,
							accuracyMeters: liveRow.accuracyMeters,
							recordedAt: liveRow.recordedAt,
							receivedAt: liveRow.receivedAt,
							source: liveRow.source,
						})
					: null,
				activeRental: activeRental
					? {
							id: activeRental.id,
							status: activeRental.status,
							customerName: activeRental.customerName,
							plannedStartAt:
								activeRental.plannedStartAt?.toISOString() ?? null,
							plannedEndAt: activeRental.plannedEndAt?.toISOString() ?? null,
						}
					: null,
				device: liveRow?.deviceId
					? {
							id: liveRow.deviceId,
							displayName: liveRow.deviceDisplayName,
							provider: liveRow.deviceProvider,
							externalDeviceId: liveRow.externalDeviceId,
						}
					: null,
			}
		})
		.sort((left, right) => {
			if (left.isRentedNow !== right.isRentedNow) {
				return left.isRentedNow ? -1 : 1
			}

			const statusDiff =
				liveStatusSortOrder[left.telemetryStatus] -
				liveStatusSortOrder[right.telemetryStatus]
			if (statusDiff !== 0) {
				return statusDiff
			}

			return left.licensePlate.localeCompare(right.licensePlate)
		})

	return {
		vehicles,
		canViewLiveFleet: true,
		defaultViewport: getFleetViewportDefaults(),
	}
}

export async function getFleetVehicleLiveDetail(
	organizationId: string,
	vehicleId: string,
	hours: number,
): Promise<FleetVehicleLiveDetailResponse> {
	const [vehicleRows, liveRows, trailRows, rentalRows] = await Promise.all([
		db
			.select({
				id: vehicle.id,
				brandName: vehicleBrand.name,
				modelName: vehicleModel.name,
				year: vehicle.year,
				licensePlate: vehicle.licensePlate,
				status: vehicle.status,
			})
			.from(vehicle)
			.innerJoin(vehicleBrand, eq(vehicle.brandId, vehicleBrand.id))
			.innerJoin(vehicleModel, eq(vehicle.modelId, vehicleModel.id))
			.where(
				and(
					eq(vehicle.organizationId, organizationId),
					eq(vehicle.id, vehicleId),
				),
			),
		db
			.select({
				vehicleId: vehicleLivePosition.vehicleId,
				latitude: vehicleLivePosition.latitude,
				longitude: vehicleLivePosition.longitude,
				speedKph: vehicleLivePosition.speedKph,
				heading: vehicleLivePosition.heading,
				accuracyMeters: vehicleLivePosition.accuracyMeters,
				recordedAt: vehicleLivePosition.recordedAt,
				receivedAt: vehicleLivePosition.receivedAt,
				source: vehicleLivePosition.source,
				deviceId: vehicleTrackingDevice.id,
				deviceDisplayName: vehicleTrackingDevice.displayName,
				deviceProvider: vehicleTrackingDevice.provider,
				externalDeviceId: vehicleTrackingDevice.externalDeviceId,
			})
			.from(vehicleLivePosition)
			.leftJoin(
				vehicleTrackingDevice,
				eq(vehicleLivePosition.deviceId, vehicleTrackingDevice.id),
			)
			.where(
				and(
					eq(vehicleLivePosition.organizationId, organizationId),
					eq(vehicleLivePosition.vehicleId, vehicleId),
				),
			),
		db
			.select({
				id: vehiclePositionHistory.id,
				latitude: vehiclePositionHistory.latitude,
				longitude: vehiclePositionHistory.longitude,
				speedKph: vehiclePositionHistory.speedKph,
				heading: vehiclePositionHistory.heading,
				recordedAt: vehiclePositionHistory.recordedAt,
				source: vehiclePositionHistory.source,
			})
			.from(vehiclePositionHistory)
			.where(
				and(
					eq(vehiclePositionHistory.organizationId, organizationId),
					eq(vehiclePositionHistory.vehicleId, vehicleId),
					gte(
						vehiclePositionHistory.recordedAt,
						new Date(Date.now() - Math.max(1, hours) * 60 * 60_000),
					),
				),
			)
			.orderBy(asc(vehiclePositionHistory.recordedAt)),
		db
			.select({
				id: rental.id,
				status: rental.status,
				plannedStartAt: rental.plannedStartAt,
				plannedEndAt: rental.plannedEndAt,
				customerName: customer.fullName,
			})
			.from(rental)
			.leftJoin(customer, eq(rental.customerId, customer.id))
			.where(
				and(
					eq(rental.organizationId, organizationId),
					eq(rental.vehicleId, vehicleId),
					inArray(rental.status, ["scheduled", "active"]),
				),
			)
			.orderBy(desc(rental.updatedAt)),
	])

	const row = vehicleRows[0]
	if (!row) {
		return {
			vehicle: null,
			canViewLiveFleet: true,
			defaultViewport: getFleetViewportDefaults(),
		}
	}

	const liveRow = liveRows[0]
	const activeRental =
		rentalRows.find((entry) => entry.status === "active") ??
		rentalRows[0] ??
		null
	const telemetryStatus = deriveFleetTelemetryStatus({
		recordedAt: liveRow?.recordedAt ?? null,
		speedKph: liveRow?.speedKph ?? null,
	})

	return {
		vehicle: {
			id: row.id,
			label: buildVehicleLabel(row),
			licensePlate: row.licensePlate,
			status: row.status,
			telemetryStatus,
			isRentedNow: Boolean(activeRental || row.status === "Rented"),
			snapshot: liveRow
				? serializeSnapshot({
						latitude: liveRow.latitude,
						longitude: liveRow.longitude,
						speedKph: liveRow.speedKph,
						heading: liveRow.heading,
						accuracyMeters: liveRow.accuracyMeters,
						recordedAt: liveRow.recordedAt,
						receivedAt: liveRow.receivedAt,
						source: liveRow.source,
					})
				: null,
			activeRental: activeRental
				? {
						id: activeRental.id,
						status: activeRental.status as "scheduled" | "active",
						customerName: activeRental.customerName,
						plannedStartAt: activeRental.plannedStartAt?.toISOString() ?? null,
						plannedEndAt: activeRental.plannedEndAt?.toISOString() ?? null,
					}
				: null,
			device: liveRow?.deviceId
				? {
						id: liveRow.deviceId,
						displayName: liveRow.deviceDisplayName,
						provider: liveRow.deviceProvider,
						externalDeviceId: liveRow.externalDeviceId,
					}
				: null,
			trail: trailRows.map((entry) => ({
				id: entry.id,
				latitude: entry.latitude,
				longitude: entry.longitude,
				speedKph: entry.speedKph,
				heading: entry.heading,
				recordedAt: entry.recordedAt.toISOString(),
				source: entry.source,
			})),
		},
		canViewLiveFleet: true,
		defaultViewport: getFleetViewportDefaults(),
	}
}
