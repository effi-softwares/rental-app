import { useQuery } from "@tanstack/react-query"

import type {
	PaymentLedgerFilters,
	PaymentLedgerResponse,
} from "@/features/payments/types/payments"
import { paymentsQueryKeys } from "./keys"

function buildLedgerUrl(filters: PaymentLedgerFilters) {
	const params = new URLSearchParams()
	if (filters.preset) {
		params.set("preset", filters.preset)
	}
	if (filters.search) {
		params.set("search", filters.search)
	}
	if (filters.page) {
		params.set("page", String(filters.page))
	}
	if (filters.pageSize) {
		params.set("pageSize", String(filters.pageSize))
	}

	const query = params.toString()
	return query.length > 0
		? `/api/payments/ledger?${query}`
		: "/api/payments/ledger"
}

export function usePaymentsLedgerQuery(
	organizationId?: string,
	filters: PaymentLedgerFilters = {},
) {
	return useQuery({
		queryKey: paymentsQueryKeys.ledger(organizationId, filters),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const response = await fetch(buildLedgerUrl(filters), {
				method: "GET",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load payments ledger.")
			}

			return (await response.json()) as PaymentLedgerResponse
		},
		placeholderData: (previous) => previous,
	})
}
