import { useMutation, useQueryClient } from "@tanstack/react-query"

import { authClient } from "@/lib/auth-client"
import { mainQueryKeys } from "../queries/keys"
import { setActiveOrganization } from "./active-organization"

type CreateOrganizationInput = {
	name: string
	slug: string
	logo: string
	logoBlurDataUrl?: string | null
}

export function useCreateOrganizationMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			name,
			slug,
			logo,
			logoBlurDataUrl,
		}: CreateOrganizationInput) => {
			const { data, error } = await authClient.organization.create({
				name,
				slug,
				logo,
				metadata: logoBlurDataUrl
					? {
							logoBlurDataUrl,
						}
					: undefined,
				keepCurrentActiveOrganization: false,
			})

			if (error) {
				throw new Error(
					error.message ?? "Unable to create organization. Please try again.",
				)
			}

			const organizationId = data?.id
			if (organizationId) {
				await setActiveOrganization(organizationId)
			}

			return { organizationId }
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: mainQueryKeys.all,
			})
		},
	})
}
