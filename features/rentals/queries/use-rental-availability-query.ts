import { useQuery } from "@tanstack/react-query"

import type {
	RentalAlternativeMatchMode,
	RentalAvailabilityResponse,
} from "@/features/rentals/types/rental"
import { rentalsQueryKeys } from "./keys"

type UseRentalAvailabilityQueryInput = {
	organizationId?: string
	vehicleId?: string | null
	rentalId?: string | null
	startsAt?: string | null
	endsAt?: string | null
	matchMode?: RentalAlternativeMatchMode
	enabled?: boolean
}

export function useRentalAvailabilityQuery(
	input: UseRentalAvailabilityQueryInput,
) {
	const vehicleId = input.vehicleId ?? null
	const startsAt = input.startsAt ?? null
	const endsAt = input.endsAt ?? null
	const matchMode = input.matchMode ?? "same_class"

	return useQuery({
		queryKey: rentalsQueryKeys.availability(input.organizationId, {
			vehicleId,
			rentalId: input.rentalId ?? null,
			startsAt,
			endsAt,
			matchMode,
		}),
		enabled: Boolean(
			input.enabled !== false &&
				input.organizationId &&
				vehicleId &&
				startsAt &&
				endsAt,
		),
		queryFn: async ({ signal }) => {
			const response = await fetch("/api/rental-availability/check", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					vehicleId,
					rentalId: input.rentalId ?? null,
					startsAt,
					endsAt,
					matchMode,
				}),
				signal,
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(
					payload?.error ?? "Failed to check rental availability.",
				)
			}

			return (await response.json()) as RentalAvailabilityResponse
		},
	})
}
