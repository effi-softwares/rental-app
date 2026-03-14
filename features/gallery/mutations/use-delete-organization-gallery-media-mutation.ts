"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { galleryQueryKeys } from "../queries/keys"

type DeleteOrganizationGalleryMediaInput = {
	mediaId: string
	organizationId: string
}

export function useDeleteOrganizationGalleryMediaMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: DeleteOrganizationGalleryMediaInput) => {
			const response = await fetch(`/api/gallery/media/${input.mediaId}`, {
				method: "DELETE",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to delete gallery image.")
			}
		},
		onSuccess: async (_result, input) => {
			await queryClient.invalidateQueries({
				queryKey: galleryQueryKeys.list(input.organizationId),
			})
		},
	})
}
