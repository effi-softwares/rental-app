export type WorkspaceLiveTopic = "billing_attention" | "rentals"
export type WorkspaceLiveAttention = "none" | "info" | "warning" | "critical"

export type WorkspaceLiveEvent = {
	id: string
	topic: WorkspaceLiveTopic
	type: string
	organizationId: string
	branchId: string | null
	entityType: string
	entityId: string
	attention: WorkspaceLiveAttention
	summary: string | null
	occurredAt: string
	payload: Record<string, unknown>
}
