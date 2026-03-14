import { useQuery } from "@tanstack/react-query"

import type { PaymentDetailResponse } from "@/features/payments/types/payments"
import { paymentsQueryKeys } from "./keys"

export function usePaymentDetailQuery(
	organizationId?: string,
	paymentId?: string | null,
	enabled = true,
) {
	return useQuery({
		queryKey: paymentsQueryKeys.detail(organizationId, paymentId),
		enabled: Boolean(organizationId && paymentId && enabled),
		queryFn: async () => {
			const response = await fetch(`/api/payments/${paymentId}`, {
				method: "GET",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load payment detail.")
			}

			return (await response.json()) as PaymentDetailResponse
		},
	})
}
