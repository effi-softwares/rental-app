import { useQuery } from "@tanstack/react-query"

import type { VehicleCatalogResponse } from "@/features/vehicles/types/vehicle"
import { vehiclesQueryKeys } from "./keys"

export function useVehicleCatalogQuery(organizationId?: string) {
	return useQuery({
		queryKey: vehiclesQueryKeys.list(organizationId),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const response = await fetch("/api/vehicle-catalog", { method: "GET" })

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load vehicles.")
			}

			return (await response.json()) as VehicleCatalogResponse
		},
	})
}
