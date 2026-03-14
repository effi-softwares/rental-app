import { useMutation, useQueryClient } from "@tanstack/react-query"

import { vehiclesQueryKeys } from "@/features/vehicles/queries/keys"
import type { VehicleStatus } from "@/features/vehicles/types/vehicle"

export function useUpdateVehicleStatusMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			vehicleId,
			status,
		}: {
			vehicleId: string
			status: VehicleStatus
		}) => {
			const response = await fetch(`/api/vehicle-catalog/${vehicleId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ operations: { status } }),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to update vehicle status.")
			}
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
