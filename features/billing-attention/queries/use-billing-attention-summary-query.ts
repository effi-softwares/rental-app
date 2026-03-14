import { useQuery } from "@tanstack/react-query"

import type { BillingAttentionSummaryResponse } from "@/features/billing-attention/types/billing-attention"
import { billingAttentionQueryKeys } from "./keys"

export function useBillingAttentionSummaryQuery(organizationId?: string) {
	return useQuery({
		queryKey: billingAttentionQueryKeys.attentionSummary(organizationId),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const response = await fetch("/api/billing-attention/summary", {
				method: "GET",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(
					payload?.error ?? "Failed to load billing attention alerts.",
				)
			}

			return (await response.json()) as BillingAttentionSummaryResponse
		},
		refetchInterval: 60_000,
	})
}
