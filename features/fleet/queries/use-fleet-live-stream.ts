"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import type {
	FleetLiveResponse,
	FleetLiveSnapshot,
	FleetLiveVehicleListItem,
	FleetStreamEvent,
	FleetVehicleLiveDetailResponse,
} from "@/features/fleet/types/fleet"
import {
	deriveFleetTelemetryStatus,
	getFreshnessSeconds,
} from "@/lib/fleet/live"
import { fleetQueryKeys } from "./keys"

function refreshSnapshot(snapshot: FleetLiveSnapshot | null) {
	if (!snapshot) {
		return null
	}

	return {
		...snapshot,
		freshnessSeconds: getFreshnessSeconds(snapshot.recordedAt),
	}
}

function compareFleetVehicles(
	left: FleetLiveVehicleListItem,
	right: FleetLiveVehicleListItem,
) {
	if (left.isRentedNow !== right.isRentedNow) {
		return left.isRentedNow ? -1 : 1
	}

	const priority = {
		moving: 0,
		parked: 1,
		offline: 2,
		no_data: 3,
	} as const

	const statusDiff =
		priority[left.telemetryStatus] - priority[right.telemetryStatus]
	if (statusDiff !== 0) {
		return statusDiff
	}

	return left.licensePlate.localeCompare(right.licensePlate)
}

function refreshListVehicle(vehicle: FleetLiveVehicleListItem) {
	const snapshot = refreshSnapshot(vehicle.snapshot)
	return {
		...vehicle,
		snapshot,
		telemetryStatus: deriveFleetTelemetryStatus({
			recordedAt: snapshot?.recordedAt ?? null,
			speedKph: snapshot?.speedKph ?? null,
		}),
	}
}

function applyEventSnapshot(
	vehicle: FleetLiveVehicleListItem,
	event: FleetStreamEvent,
) {
	const snapshot = refreshSnapshot(event.snapshot.position)
	return {
		...vehicle,
		isRentedNow: event.snapshot.isRentedNow,
		snapshot,
		telemetryStatus: event.snapshot.telemetryStatus,
	}
}

function parseStreamEvent(data: string) {
	try {
		return JSON.parse(data) as FleetStreamEvent
	} catch {
		return null
	}
}

export function useFleetLiveStream(organizationId?: string, enabled = true) {
	const queryClient = useQueryClient()

	useEffect(() => {
		if (!organizationId || !enabled) {
			return
		}

		const stream = new EventSource("/api/fleet/live/stream")

		const handleStreamMessage = (rawEvent: MessageEvent<string>) => {
			const payload = parseStreamEvent(rawEvent.data)
			if (!payload) {
				return
			}

			if (
				payload.type !== "vehicle.position.updated" ||
				payload.organizationId !== organizationId
			) {
				return
			}

			queryClient.setQueryData<FleetLiveResponse>(
				fleetQueryKeys.live(organizationId),
				(current) => {
					if (!current) {
						return current
					}

					const nextVehicles = current.vehicles
						.map((vehicle) =>
							vehicle.id === payload.vehicleId
								? applyEventSnapshot(vehicle, payload)
								: refreshListVehicle(vehicle),
						)
						.sort(compareFleetVehicles)

					return {
						...current,
						vehicles: nextVehicles,
					}
				},
			)

			queryClient.setQueriesData<FleetVehicleLiveDetailResponse>(
				{
					queryKey: fleetQueryKeys.vehiclePrefix(
						organizationId,
						payload.vehicleId,
					),
				},
				(current) => {
					if (!current?.vehicle) {
						return current
					}

					return {
						...current,
						vehicle: {
							...current.vehicle,
							telemetryStatus: payload.snapshot.telemetryStatus,
							isRentedNow: payload.snapshot.isRentedNow,
							snapshot: refreshSnapshot(payload.snapshot.position),
							trail: payload.trailAppend
								? [...current.vehicle.trail, payload.trailAppend].slice(-120)
								: current.vehicle.trail,
						},
					}
				},
			)
		}

		stream.onmessage = handleStreamMessage
		stream.addEventListener(
			"vehicle.position.updated",
			handleStreamMessage as EventListener,
		)

		const refreshTimer = window.setInterval(() => {
			queryClient.setQueryData<FleetLiveResponse>(
				fleetQueryKeys.live(organizationId),
				(current) => {
					if (!current) {
						return current
					}

					return {
						...current,
						vehicles: current.vehicles
							.map(refreshListVehicle)
							.sort(compareFleetVehicles),
					}
				},
			)

			queryClient.setQueriesData<FleetVehicleLiveDetailResponse>(
				{
					queryKey: fleetQueryKeys.vehicleOrganizationPrefix(organizationId),
				},
				(current) => {
					if (!current?.vehicle) {
						return current
					}

					const snapshot = refreshSnapshot(current.vehicle.snapshot)
					return {
						...current,
						vehicle: {
							...current.vehicle,
							snapshot,
							telemetryStatus: deriveFleetTelemetryStatus({
								recordedAt: snapshot?.recordedAt ?? null,
								speedKph: snapshot?.speedKph ?? null,
							}),
						},
					}
				},
			)
		}, 15_000)

		return () => {
			window.clearInterval(refreshTimer)
			stream.removeEventListener(
				"vehicle.position.updated",
				handleStreamMessage as EventListener,
			)
			stream.close()
		}
	}, [enabled, organizationId, queryClient])
}
