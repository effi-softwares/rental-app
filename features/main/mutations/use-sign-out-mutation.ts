import { useMutation, useQueryClient } from "@tanstack/react-query"

import { authClient } from "@/lib/auth-client"
import { mainQueryKeys } from "../queries/keys"

export function useSignOutMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async () => {
			const { error } = await authClient.signOut()

			if (error) {
				throw new Error(error.message ?? "Failed to sign out.")
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: mainQueryKeys.all,
			})
		},
	})
}
