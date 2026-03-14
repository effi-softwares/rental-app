import { and, asc, eq, gt, inArray, isNull, or, type SQL } from "drizzle-orm"

import { db } from "@/lib/db"
import { workspaceRealtimeEvent } from "@/lib/db/schema/workspace"

export type WorkspaceRealtimeEventInput = {
	organizationId: string
	branchId: string | null
	topic: typeof workspaceRealtimeEvent.$inferInsert.topic
	eventType: string
	entityType: string
	entityId: string
	attention?: typeof workspaceRealtimeEvent.$inferInsert.attention
	summary?: string | null
	payload?: Record<string, unknown>
}

export async function publishWorkspaceRealtimeEvents(
	database: typeof db,
	events: WorkspaceRealtimeEventInput[],
) {
	if (events.length === 0) {
		return
	}

	await database.insert(workspaceRealtimeEvent).values(
		events.map((event) => ({
			organizationId: event.organizationId,
			branchId: event.branchId,
			topic: event.topic,
			eventType: event.eventType,
			entityType: event.entityType,
			entityId: event.entityId,
			attention: event.attention ?? "none",
			summary: event.summary ?? null,
			payloadJson: event.payload ?? {},
		})),
	)
}

export function buildWorkspaceStreamMessage(input: {
	event?: string
	id?: string
	data?: Record<string, unknown> | null
	comment?: string
}) {
	if (input.comment) {
		return `: ${input.comment}\n\n`
	}

	const lines = []
	if (input.id) {
		lines.push(`id: ${input.id}`)
	}

	if (input.event) {
		lines.push(`event: ${input.event}`)
	}

	lines.push(`data: ${JSON.stringify(input.data ?? {})}`)
	return `${lines.join("\n")}\n\n`
}

export async function getWorkspaceRealtimeEventsAfter(input: {
	organizationId: string
	topics: Array<typeof workspaceRealtimeEvent.$inferSelect.topic>
	branchIds: string[] | null
	afterId?: number | null
	limit?: number
}) {
	const predicates: SQL[] = [
		eq(workspaceRealtimeEvent.organizationId, input.organizationId),
		inArray(workspaceRealtimeEvent.topic, input.topics),
	]

	if (typeof input.afterId === "number") {
		predicates.push(gt(workspaceRealtimeEvent.id, input.afterId))
	}

	if (input.branchIds !== null) {
		if (input.branchIds.length > 0) {
			const branchPredicate = or(
				isNull(workspaceRealtimeEvent.branchId),
				inArray(workspaceRealtimeEvent.branchId, input.branchIds),
			)

			if (branchPredicate) {
				predicates.push(branchPredicate)
			}
		} else {
			predicates.push(isNull(workspaceRealtimeEvent.branchId))
		}
	}

	return db
		.select()
		.from(workspaceRealtimeEvent)
		.where(and(...predicates))
		.orderBy(asc(workspaceRealtimeEvent.id))
		.limit(input.limit ?? 100)
}
