import type { PaymentLedgerFilters } from "@/features/payments/types/payments"

export const paymentsQueryKeys = {
	all: ["payments"] as const,
	summary: (organizationId?: string) =>
		[...paymentsQueryKeys.all, "summary", organizationId ?? ""] as const,
	ledger: (organizationId?: string, filters?: PaymentLedgerFilters) =>
		[
			...paymentsQueryKeys.all,
			"ledger",
			organizationId ?? "",
			filters?.preset ?? "all",
			filters?.search ?? "",
			filters?.page ?? 1,
			filters?.pageSize ?? 25,
		] as const,
	detail: (organizationId?: string, paymentId?: string | null) =>
		[
			...paymentsQueryKeys.all,
			"detail",
			organizationId ?? "",
			paymentId ?? "",
		] as const,
	webhooks: (organizationId?: string, status?: "all" | "failed") =>
		[
			...paymentsQueryKeys.all,
			"webhooks",
			organizationId ?? "",
			status ?? "all",
		] as const,
}
