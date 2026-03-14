export type BillingAttentionSummaryResponse = {
	openAttentionCount: number
	rentalsAwaitingPaymentCount: number
	requiresActionPaymentsCount: number
	failedPaymentsCount: number
	pendingDirectDebitCount: number
}

export type BillingAttentionOverviewResponse = {
	summary: BillingAttentionSummaryResponse
	recentWebhookEvents: Array<{
		id: string
		stripeEventId: string
		type: string
		status: "received" | "processed" | "ignored" | "failed"
		mode: string
		objectType: string | null
		objectId: string | null
		errorMessage: string | null
		receivedAt: string
		processedAt: string | null
	}>
	recentAttentionEvents: Array<{
		id: string
		topic: "billing_attention" | "rentals"
		eventType: string
		entityType: string
		entityId: string
		stripeEventId: string | null
		attention: "none" | "info" | "warning" | "critical"
		summary: string | null
		createdAt: string
	}>
}
