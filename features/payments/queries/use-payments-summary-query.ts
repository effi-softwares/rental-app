import { useQuery } from "@tanstack/react-query"

import type { PaymentSummaryResponse } from "@/features/payments/types/payments"
import { paymentsQueryKeys } from "./keys"

export function usePaymentsSummaryQuery(organizationId?: string) {
	return useQuery({
		queryKey: paymentsQueryKeys.summary(organizationId),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const response = await fetch("/api/payments/summary", {
				method: "GET",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load payment summary.")
			}

			return (await response.json()) as PaymentSummaryResponse
		},
	})
}
