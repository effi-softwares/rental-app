import { useQuery } from "@tanstack/react-query"

import type { VehicleDetails } from "@/features/vehicles/types/vehicle"
import { vehiclesQueryKeys } from "./keys"

export function useVehicleDetailsQuery(
	organizationId?: string,
	vehicleId?: string,
) {
	return useQuery({
		queryKey: vehiclesQueryKeys.detail(organizationId, vehicleId),
		enabled: Boolean(organizationId && vehicleId),
		queryFn: async () => {
			const response = await fetch(`/api/vehicle-catalog/${vehicleId}`, {
				method: "GET",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load vehicle details.")
			}

			return (await response.json()) as VehicleDetails
		},
	})
}
