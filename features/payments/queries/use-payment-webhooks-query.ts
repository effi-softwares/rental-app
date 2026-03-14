import { useQuery } from "@tanstack/react-query"

import type { PaymentWebhooksResponse } from "@/features/payments/types/payments"
import { paymentsQueryKeys } from "./keys"

export function usePaymentWebhooksQuery(
	organizationId?: string,
	status: "all" | "failed" = "all",
) {
	return useQuery({
		queryKey: paymentsQueryKeys.webhooks(organizationId, status),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const params = new URLSearchParams({
				status,
			})
			const response = await fetch(
				`/api/payments/webhooks?${params.toString()}`,
				{
					method: "GET",
				},
			)

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load payment webhooks.")
			}

			return (await response.json()) as PaymentWebhooksResponse
		},
	})
}
