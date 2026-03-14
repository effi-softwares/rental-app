"use client"

import { useQuery } from "@tanstack/react-query"

import type { MediaAsset } from "@/features/media"
import { galleryQueryKeys } from "./keys"

type OrganizationGalleryResponse = {
	assets: MediaAsset[]
	canManageGalleryMedia: boolean
}

export function useOrganizationGalleryQuery(organizationId?: string) {
	return useQuery({
		queryKey: galleryQueryKeys.list(organizationId ?? ""),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const response = await fetch("/api/gallery/media", { method: "GET" })

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(
					payload?.error ?? "Failed to load organization gallery.",
				)
			}

			return (await response.json()) as OrganizationGalleryResponse
		},
	})
}
