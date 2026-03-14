import { useMutation, useQueryClient } from "@tanstack/react-query"

import { vehiclesQueryKeys } from "@/features/vehicles/queries/keys"
import type { VehicleCreatePayload } from "@/features/vehicles/types/vehicle"

export function useUpdateVehicleMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			vehicleId,
			payload,
		}: {
			vehicleId: string
			payload: VehicleCreatePayload
		}) => {
			const response = await fetch(`/api/vehicle-catalog/${vehicleId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			})

			if (!response.ok) {
				const errorPayload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(errorPayload?.error ?? "Failed to update vehicle.")
			}

			return response.json()
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: vehiclesQueryKeys.list(organizationId),
			})
			await queryClient.invalidateQueries({
				queryKey: vehiclesQueryKeys.detail(organizationId, variables.vehicleId),
			})
		},
	})
}
