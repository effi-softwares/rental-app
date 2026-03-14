"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { upload } from "@vercel/blob/client"

import {
	generateBlurDataUrl,
	readImageDimensions,
} from "@/lib/media/client-image"
import { getMediaKindFromContentType } from "@/lib/media/media-kind"
import { buildMediaPathname } from "@/lib/media/pathname"
import type { StorageBucket } from "@/lib/storage"
import { mediaQueryKeys } from "../queries/keys"
import type { MediaVisibility } from "../types/media"

type UploadImageInput = {
	organizationId: string
	file: File
	entityType: string
	entityId: string
	handleUploadUrl?: string
	finalizeUrl?: string
	storageBucket?: StorageBucket
	field?: string
	sortOrder?: number
	branchId?: string | null
	visibility?: MediaVisibility
	metadata?: Record<string, unknown>
	onUploadProgress?: (percentage: number) => void
}

type UploadImageResult = {
	assetId: string
	url: string
	deliveryUrl: string
	blurDataUrl: string | null
}

export function useUploadImageMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: UploadImageInput): Promise<UploadImageResult> => {
			const storageBucket = input.storageBucket ?? "private"
			const visibility = input.visibility ?? "private"
			const handleUploadUrl = input.handleUploadUrl ?? "/api/media/upload"
			const finalizeUrl = input.finalizeUrl ?? "/api/media/finalize"
			const mediaKind = getMediaKindFromContentType(input.file.type)
			const dimensions =
				mediaKind === "image" ? await readImageDimensions(input.file) : null
			const blurDataUrl =
				mediaKind === "image" ? await generateBlurDataUrl(input.file) : null

			if (mediaKind === "image" && !blurDataUrl) {
				throw new Error("Unable to generate blur preview for this image.")
			}

			const pathname = buildMediaPathname({
				organizationId: input.organizationId,
				entityType: input.entityType,
				entityId: input.entityId,
				fileName: input.file.name,
			})

			const metadata = {
				...(input.metadata ?? {}),
				mediaKind,
			}

			const clientPayload = {
				organizationId: input.organizationId,
				storageBucket,
				visibility,
				branchId: input.branchId ?? null,
				originalFileName: input.file.name,
				contentType: input.file.type,
				sizeBytes: input.file.size,
				width: dimensions?.width ?? null,
				height: dimensions?.height ?? null,
				blurDataUrl,
				metadata,
				link: {
					entityType: input.entityType,
					entityId: input.entityId,
					field: input.field ?? "default",
					sortOrder: input.sortOrder ?? 0,
				},
			}

			const blob = await upload(pathname, input.file, {
				access: visibility,
				handleUploadUrl,
				clientPayload: JSON.stringify(clientPayload),
				multipart: input.file.size > 100 * 1024 * 1024,
				onUploadProgress: (event) => {
					input.onUploadProgress?.(event.percentage)
				},
			})

			const finalizeResponse = await fetch(finalizeUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ blob, ...clientPayload }),
			})

			if (!finalizeResponse.ok) {
				const payload = (await finalizeResponse.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to finalize upload.")
			}

			const finalized = (await finalizeResponse.json()) as {
				assetId: string
				deliveryUrl: string
			}

			return {
				assetId: finalized.assetId,
				url: blob.url,
				deliveryUrl: finalized.deliveryUrl,
				blurDataUrl,
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
