import { useQuery } from "@tanstack/react-query"

import type { RentalListResponse } from "@/features/rentals/types/rental"
import { rentalsQueryKeys } from "./keys"

export function useRentalsListQuery(
	organizationId?: string,
	statusFilter?: string,
) {
	return useQuery({
		queryKey: rentalsQueryKeys.list(organizationId, statusFilter),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const query = new URLSearchParams()
			if (statusFilter?.trim()) {
				query.set("status", statusFilter)
			}

			const response = await fetch(
				query.size > 0 ? `/api/rentals?${query.toString()}` : "/api/rentals",
				{
					method: "GET",
				},
			)

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load rentals.")
			}

			return (await response.json()) as RentalListResponse
		},
	})
}
