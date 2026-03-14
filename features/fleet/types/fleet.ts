import type { VehicleStatus } from "@/features/vehicles"
import type {
	FleetTelemetrySource,
	FleetTelemetryStatus,
	FleetViewportDefaults,
} from "@/lib/fleet/live"

export type FleetLiveSnapshot = {
	latitude: number
	longitude: number
	speedKph: number | null
	heading: number | null
	accuracyMeters: number | null
	recordedAt: string
	receivedAt: string
	source: FleetTelemetrySource
	freshnessSeconds: number | null
}

export type FleetPositionPoint = {
	id: string
	latitude: number
	longitude: number
	speedKph: number | null
	heading: number | null
	recordedAt: string
	source: FleetTelemetrySource
}

export type FleetLiveRentalHint = {
	id: string
	status: "scheduled" | "active"
	customerName: string | null
	plannedStartAt: string | null
	plannedEndAt: string | null
}

export type FleetLiveVehicleListItem = {
	id: string
	label: string
	licensePlate: string
	brandName: string
	modelName: string
	year: number
	status: VehicleStatus
	telemetryStatus: FleetTelemetryStatus
	isRentedNow: boolean
	frontImage: {
		assetId: string
		deliveryUrl: string
		blurDataUrl: string
	} | null
	snapshot: FleetLiveSnapshot | null
	activeRental: FleetLiveRentalHint | null
	device: {
		id: string
		displayName: string | null
		provider: string | null
		externalDeviceId: string | null
	} | null
}

export type FleetLiveResponse = {
	vehicles: FleetLiveVehicleListItem[]
	canViewLiveFleet: boolean
	defaultViewport: FleetViewportDefaults
}

export type FleetVehicleLiveDetailResponse = {
	vehicle: {
		id: string
		label: string
		licensePlate: string
		status: VehicleStatus
		telemetryStatus: FleetTelemetryStatus
		isRentedNow: boolean
		snapshot: FleetLiveSnapshot | null
		activeRental: FleetLiveRentalHint | null
		device: {
			id: string
			displayName: string | null
			provider: string | null
			externalDeviceId: string | null
		} | null
		trail: FleetPositionPoint[]
	} | null
	canViewLiveFleet: boolean
	defaultViewport: FleetViewportDefaults
}

export type FleetStreamEvent = {
	type: "vehicle.position.updated"
	organizationId: string
	vehicleId: string
	snapshot: {
		telemetryStatus: FleetTelemetryStatus
		isRentedNow: boolean
		position: FleetLiveSnapshot | null
	}
	trailAppend?: FleetPositionPoint | null
}
