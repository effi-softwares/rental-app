import { useQuery } from "@tanstack/react-query"

import type { VehicleMetaResponse } from "@/features/vehicles/types/vehicle"
import { vehiclesQueryKeys } from "./keys"

export function useVehicleCatalogMetaQuery(organizationId?: string) {
	return useQuery({
		queryKey: vehiclesQueryKeys.meta(organizationId),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const response = await fetch("/api/vehicle-catalog/meta", {
				method: "GET",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load vehicle metadata.")
			}

			return (await response.json()) as VehicleMetaResponse
		},
	})
}
