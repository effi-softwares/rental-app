import { useQuery } from "@tanstack/react-query"

import type { MainOrganization } from "../types/organization"
import { mainQueryKeys } from "./keys"

export function useOrganizationsQuery() {
	return useQuery({
		queryKey: mainQueryKeys.organizations(),
		queryFn: async () => {
			const response = await fetch("/api/organizations/accessible")
			const payload = (await response.json().catch(() => null)) as {
				organizations?: MainOrganization[]
				error?: string
			} | null

			if (!response.ok) {
				throw new Error(payload?.error ?? "Failed to load organizations.")
			}

			return Array.isArray(payload?.organizations) ? payload.organizations : []
		},
	})
}
