import { useQuery } from "@tanstack/react-query"

import type { BillingAttentionOverviewResponse } from "@/features/billing-attention/types/billing-attention"
import { billingAttentionQueryKeys } from "./keys"

export function useBillingAttentionOverviewQuery(organizationId?: string) {
	return useQuery({
		queryKey: billingAttentionQueryKeys.overview(organizationId),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const response = await fetch("/api/billing-attention/overview", {
				method: "GET",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(
					payload?.error ?? "Failed to load billing attention overview.",
				)
			}

			return (await response.json()) as BillingAttentionOverviewResponse
		},
	})
}
