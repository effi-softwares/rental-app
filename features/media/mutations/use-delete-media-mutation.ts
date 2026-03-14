"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { mediaQueryKeys } from "../queries/keys"

type DeleteMediaInput = {
	mediaId: string
	organizationId: string
	entityType?: string
	entityId?: string
	field?: string
}

export function useDeleteMediaMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: DeleteMediaInput) => {
			const response = await fetch(`/api/media/${input.mediaId}`, {
				method: "DELETE",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to delete media.")
			}
		},
		onSuccess: async (_result, input) => {
			await queryClient.invalidateQueries({
				queryKey: mediaQueryKeys.list(
					input.organizationId,
					input.entityType,
					input.entityId,
					input.field,
				),
			})
		},
	})
}
