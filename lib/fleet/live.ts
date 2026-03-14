import { fleetMapDefaults } from "./config"

export type FleetTelemetryStatus = "moving" | "parked" | "offline" | "no_data"
export type FleetTelemetrySource = "mock" | "traccar"

export type FleetViewportDefaults = {
	center: [number, number]
	zoom: number
	selectedZoom: number
	pitch: number
	bearing: number
	styleUrl: string
}

export function getFleetViewportDefaults(): FleetViewportDefaults {
	return {
		center: [fleetMapDefaults.center.lng, fleetMapDefaults.center.lat],
		zoom: fleetMapDefaults.zoom,
		selectedZoom: fleetMapDefaults.selectedZoom,
		pitch: fleetMapDefaults.pitch,
		bearing: fleetMapDefaults.bearing,
		styleUrl: fleetMapDefaults.styleUrl,
	}
}

export function deriveFleetTelemetryStatus(input: {
	recordedAt?: Date | string | null
	speedKph?: number | null
	now?: Date
}): FleetTelemetryStatus {
	if (!input.recordedAt) {
		return "no_data"
	}

	const recordedAt =
		typeof input.recordedAt === "string"
			? new Date(input.recordedAt)
			: input.recordedAt
	if (Number.isNaN(recordedAt.getTime())) {
		return "no_data"
	}

	const ageMs = (input.now ?? new Date()).getTime() - recordedAt.getTime()
	if (ageMs > 30 * 60_000) {
		return "offline"
	}

	const speed = input.speedKph ?? 0
	if (ageMs <= 2 * 60_000 && speed >= 8) {
		return "moving"
	}

	return "parked"
}

export function getFreshnessSeconds(recordedAt?: Date | string | null) {
	if (!recordedAt) {
		return null
	}

	const parsed =
		typeof recordedAt === "string" ? new Date(recordedAt) : recordedAt
	if (Number.isNaN(parsed.getTime())) {
		return null
	}

	return Math.max(0, Math.round((Date.now() - parsed.getTime()) / 1000))
}

export function formatFleetSourceLabel(source?: FleetTelemetrySource | null) {
	if (!source) {
		return "No feed"
	}

	return source === "traccar" ? "Traccar GPS" : "Mock feed"
}

export function isPrivilegedFleetRole(role?: string | null) {
	return role === "owner" || role === "admin"
}
