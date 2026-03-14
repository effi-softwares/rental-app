import { useQuery } from "@tanstack/react-query"

import type { RentalDetailResponse } from "@/features/rentals/types/rental"
import { rentalsQueryKeys } from "./keys"

export function useRentalDraftQuery(
	organizationId?: string,
	rentalId?: string | null,
) {
	return useQuery({
		queryKey: rentalsQueryKeys.detail(organizationId, rentalId),
		enabled: Boolean(organizationId && rentalId),
		queryFn: async () => {
			const response = await fetch(`/api/rentals/${rentalId}`, {
				method: "GET",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load rental draft.")
			}

			return (await response.json()) as RentalDetailResponse
		},
	})
}
