export const billingAttentionQueryKeys = {
	all: ["billing-attention"] as const,
	attentionSummary: (organizationId?: string) =>
		[
			...billingAttentionQueryKeys.all,
			"summary",
			organizationId ?? "",
		] as const,
	overview: (organizationId?: string) =>
		[
			...billingAttentionQueryKeys.all,
			"overview",
			organizationId ?? "",
		] as const,
}
