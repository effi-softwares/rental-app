import { useMutation, useQueryClient } from "@tanstack/react-query"

import { vehiclesQueryKeys } from "@/features/vehicles/queries/keys"

export function useDeleteVehicleMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (vehicleId: string) => {
			const response = await fetch(`/api/vehicle-catalog/${vehicleId}`, {
				method: "DELETE",
			})

			if (!response.ok) {
				const errorPayload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(errorPayload?.error ?? "Failed to delete vehicle.")
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: vehiclesQueryKeys.list(organizationId),
			})
		},
	})
}
