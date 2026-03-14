import { useQuery } from "@tanstack/react-query"

import type { FleetLiveResponse } from "@/features/fleet/types/fleet"
import { fleetQueryKeys } from "./keys"

export function useFleetLiveQuery(organizationId?: string) {
	return useQuery({
		queryKey: fleetQueryKeys.live(organizationId),
		enabled: Boolean(organizationId),
		refetchInterval: 30_000,
		queryFn: async () => {
			const response = await fetch("/api/fleet/live", { method: "GET" })
			const payload = (await response.json().catch(() => null)) as
				| (FleetLiveResponse & { error?: string })
				| null

			if (!response.ok) {
				throw new Error(payload?.error ?? "Failed to load live fleet.")
			}

			return payload as FleetLiveResponse
		},
	})
}
