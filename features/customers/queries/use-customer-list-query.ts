import { useQuery } from "@tanstack/react-query"

import type { CustomerListResponse } from "@/features/customers/types"
import { customersQueryKeys } from "./keys"

export function useCustomerListQuery(input: {
	organizationId?: string
	page: number
	pageSize: number
	search: string
	branchId: string
	verificationStatus: string
	status: string
}) {
	return useQuery({
		queryKey: customersQueryKeys.list(input.organizationId, {
			page: input.page,
			pageSize: input.pageSize,
			search: input.search,
			branchId: input.branchId,
			verificationStatus: input.verificationStatus,
			status: input.status,
		}),
		enabled: Boolean(input.organizationId),
		queryFn: async ({ signal }) => {
			const query = new URLSearchParams({
				page: String(input.page),
				pageSize: String(input.pageSize),
				status: input.status,
			})

			if (input.search) {
				query.set("search", input.search)
			}

			if (input.branchId) {
				query.set("branchId", input.branchId)
			}

			if (input.verificationStatus) {
				query.set("verificationStatus", input.verificationStatus)
			}

			const response = await fetch(`/api/customers?${query.toString()}`, {
				method: "GET",
				signal,
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load customers.")
			}

			return (await response.json()) as CustomerListResponse
		},
	})
}
