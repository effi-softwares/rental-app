import { useQuery } from "@tanstack/react-query"

import type { MediaListResponse } from "../types/media"
import { mediaQueryKeys } from "./keys"

type UseMediaListQueryInput = {
	organizationId: string | undefined
	entityType?: string
	entityId?: string
	field?: string
	enabled?: boolean
}

export function useMediaListQuery(input: UseMediaListQueryInput) {
	const { organizationId, entityType, entityId, field, enabled = true } = input

	return useQuery({
		queryKey: mediaQueryKeys.list(
			organizationId ?? "",
			entityType,
			entityId,
			field,
		),
		enabled: Boolean(organizationId) && enabled,
		queryFn: async () => {
			const query = new URLSearchParams()
			if (entityType) {
				query.set("entityType", entityType)
			}
			if (entityId) {
				query.set("entityId", entityId)
			}
			if (field) {
				query.set("field", field)
			}

			const suffix = query.toString() ? `?${query.toString()}` : ""
			const response = await fetch(`/api/media${suffix}`, { method: "GET" })

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to fetch media assets.")
			}

			return (await response.json()) as MediaListResponse
		},
	})
}
