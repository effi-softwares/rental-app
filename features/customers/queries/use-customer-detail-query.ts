import { useQuery } from "@tanstack/react-query"

import type { CustomerDetailResponse } from "@/features/customers/types"
import { customersQueryKeys } from "./keys"

export function useCustomerDetailQuery(input: {
	organizationId?: string
	customerId?: string | null
}) {
	return useQuery({
		queryKey: customersQueryKeys.detail(input.organizationId, input.customerId),
		enabled: Boolean(input.organizationId && input.customerId),
		queryFn: async ({ signal }) => {
			const response = await fetch(`/api/customers/${input.customerId}`, {
				method: "GET",
				signal,
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load customer details.")
			}

			return (await response.json()) as CustomerDetailResponse
		},
	})
}
