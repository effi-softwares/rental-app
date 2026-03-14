"use client"

import { useMutation } from "@tanstack/react-query"

import type { StorageBucket } from "@/lib/storage"
import { useUploadImageMutation } from "./use-upload-image-mutation"

type UploadImagesInput = {
	organizationId: string
	files: File[]
	entityType: string
	entityId: string
	handleUploadUrl?: string
	finalizeUrl?: string
	storageBucket?: StorageBucket
	field?: string
	branchId?: string | null
	visibility?: "public" | "private"
	metadata?: Record<string, unknown>
	onFileProgress?: (fileName: string, percentage: number) => void
}

export function useUploadImagesMutation() {
	const singleUploadMutation = useUploadImageMutation()

	return useMutation({
		mutationFn: async (input: UploadImagesInput) => {
			const uploaded: Array<{
				assetId: string
				url: string
				deliveryUrl: string
				blurDataUrl: string | null
			}> = []

			for (const [index, file] of input.files.entries()) {
				const result = await singleUploadMutation.mutateAsync({
					organizationId: input.organizationId,
					file,
					entityType: input.entityType,
					entityId: input.entityId,
					handleUploadUrl: input.handleUploadUrl,
					finalizeUrl: input.finalizeUrl,
					storageBucket: input.storageBucket,
					field: input.field,
					sortOrder: index,
					branchId: input.branchId,
					visibility: input.visibility,
					metadata: input.metadata,
					onUploadProgress: (percentage) => {
						input.onFileProgress?.(file.name, percentage)
					},
				})

				uploaded.push(result)
			}

			return uploaded
		},
	})
}
