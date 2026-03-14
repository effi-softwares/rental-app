import { useQuery } from "@tanstack/react-query"

import { customersQueryKeys } from "./keys"

export type CustomerListRecord = {
	id: string
	fullName: string
	email: string | null
	phone: string | null
	branchId: string | null
	branchName: string | null
	verificationStatus: string
	verificationMetadata: Record<string, unknown>
	createdAt: string
}

export type CustomerListResponse = {
	customers: CustomerListRecord[]
	branches: Array<{ id: string; name: string; code: string }>
	canManageCustomers: boolean
	canManageCustomerNotes: boolean
}

export function useCustomerListQuery(organizationId?: string) {
	return useQuery({
		queryKey: customersQueryKeys.list(organizationId),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const response = await fetch("/api/customers", { method: "GET" })

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
