import { useQuery } from "@tanstack/react-query"

import type { DashboardOverviewResponse } from "@/features/dashboard/types/dashboard"
import { dashboardQueryKeys } from "./keys"

export function useDashboardOverviewQuery(organizationId?: string) {
	return useQuery({
		queryKey: dashboardQueryKeys.overview(organizationId),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const response = await fetch("/api/dashboard/overview", {
				method: "GET",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load dashboard overview.")
			}

			return (await response.json()) as DashboardOverviewResponse
		},
		refetchInterval: 60_000,
	})
}
