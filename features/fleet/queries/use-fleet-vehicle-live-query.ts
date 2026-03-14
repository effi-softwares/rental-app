import { useQuery } from "@tanstack/react-query"

import type { FleetVehicleLiveDetailResponse } from "@/features/fleet/types/fleet"
import { fleetQueryKeys } from "./keys"

export function useFleetVehicleLiveQuery(
	organizationId?: string,
	vehicleId?: string,
	hours = 1,
	enabled = true,
) {
	return useQuery({
		queryKey: fleetQueryKeys.vehicle(organizationId, vehicleId, hours),
		enabled: Boolean(organizationId && vehicleId && enabled),
		refetchInterval: 30_000,
		queryFn: async () => {
			const response = await fetch(
				`/api/fleet/live/${vehicleId}?hours=${encodeURIComponent(String(hours))}`,
				{
					method: "GET",
				},
			)
			const payload = (await response.json().catch(() => null)) as
				| (FleetVehicleLiveDetailResponse & { error?: string })
				| null

			if (!response.ok) {
				throw new Error(payload?.error ?? "Failed to load vehicle live data.")
			}

			return payload as FleetVehicleLiveDetailResponse
		},
	})
}
