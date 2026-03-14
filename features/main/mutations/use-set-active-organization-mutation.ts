import { useMutation, useQueryClient } from "@tanstack/react-query"

import { mainQueryKeys } from "../queries/keys"
import { setActiveOrganization } from "./active-organization"

export function useSetActiveOrganizationMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (organizationId: string | null) =>
			setActiveOrganization(organizationId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: mainQueryKeys.all,
			})
		},
	})
}
