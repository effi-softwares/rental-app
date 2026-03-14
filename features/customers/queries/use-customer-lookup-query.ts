import { useQuery } from "@tanstack/react-query"

import { hasCustomerLookupInput } from "@/features/customers/lib/normalize"
import { customersQueryKeys } from "./keys"

export type CustomerLookupCandidate = {
	id: string
	fullName: string
	email: string | null
	phone: string | null
}

type CustomerLookupResponse = {
	customers: CustomerLookupCandidate[]
}

export function useCustomerLookupQuery(input: {
	organizationId?: string
	email?: string
	phone?: string
	enabled?: boolean
}) {
	const email = input.email?.trim() ?? ""
	const phone = input.phone?.trim() ?? ""
	const enabled =
		Boolean(input.organizationId) &&
		(input.enabled ?? true) &&
		hasCustomerLookupInput({ email, phone })

	return useQuery({
		queryKey: customersQueryKeys.lookup(input.organizationId, email, phone),
		enabled,
		queryFn: async ({ signal }) => {
			const query = new URLSearchParams()

			if (email) {
				query.set("email", email)
			}

			if (phone) {
				query.set("phone", phone)
			}

			const response = await fetch(
				`/api/customers/lookup?${query.toString()}`,
				{
					signal,
				},
			)

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to look up customers.")
			}

			return (await response.json()) as CustomerLookupResponse
		},
	})
}
