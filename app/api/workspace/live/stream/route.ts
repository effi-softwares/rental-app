import { requireViewer } from "@/lib/api/guards"
import {
	getScopedBranchIdsForViewer,
	viewerHasPermission,
} from "@/lib/authorization/server"
import {
	buildWorkspaceStreamMessage,
	getWorkspaceRealtimeEventsAfter,
} from "@/lib/workspace-live/server"

const eventStreamHeaders = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache, no-transform",
	Connection: "keep-alive",
}

const supportedTopics = ["billing_attention", "rentals"] as const

function createStreamMessage(body: string, status = 200) {
	return new Response(body, {
		status,
		headers: eventStreamHeaders,
	})
}

function parseTopics(value: string | null) {
	if (!value?.trim()) {
		return []
	}

	return Array.from(
		new Set(
			value
				.split(",")
				.map((item) => item.trim())
				.filter((item): item is (typeof supportedTopics)[number] =>
					supportedTopics.includes(item as (typeof supportedTopics)[number]),
				),
		),
	)
}

export async function GET(request: Request) {
	const guard = await requireViewer()

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	if (!viewer.activeOrganizationId) {
		return createStreamMessage(
			buildWorkspaceStreamMessage({
				event: "error",
				data: { message: "Active organization is required." },
			}),
			401,
		)
	}

	const [canManageBillingAttention, canViewBookings, scopedBranchIds] =
		await Promise.all([
			viewerHasPermission(viewer, "manageBillingAttentionModule"),
			viewerHasPermission(viewer, "viewBookingsModule"),
			getScopedBranchIdsForViewer(viewer),
		])

	const requestedTopics = parseTopics(
		new URL(request.url).searchParams.get("topics"),
	)

	const allowedTopics = (
		requestedTopics.length > 0 ? requestedTopics : supportedTopics
	).filter((topic) =>
		topic === "billing_attention" ? canManageBillingAttention : canViewBookings,
	)

	if (allowedTopics.length === 0) {
		return createStreamMessage(
			buildWorkspaceStreamMessage({
				event: "error",
				data: { message: "No realtime topics are available for this viewer." },
			}),
			403,
		)
	}

	const headerCursor = request.headers.get("last-event-id")?.trim()
	const queryCursor = new URL(request.url).searchParams
		.get("lastEventId")
		?.trim()
	let lastSeenId = Number.parseInt(headerCursor || queryCursor || "", 10)
	if (!Number.isFinite(lastSeenId)) {
		lastSeenId = 0
	}

	const encoder = new TextEncoder()

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let closed = false
			let isPolling = false
			let heartbeatInterval: ReturnType<typeof setInterval> | undefined
			let pollInterval: ReturnType<typeof setInterval> | undefined

			const send = (message: string) => {
				if (!closed) {
					controller.enqueue(encoder.encode(message))
				}
			}

			const close = () => {
				if (closed) {
					return
				}

				closed = true
				if (heartbeatInterval) {
					clearInterval(heartbeatInterval)
				}
				if (pollInterval) {
					clearInterval(pollInterval)
				}
				controller.close()
			}

			const poll = async () => {
				if (closed || isPolling) {
					return
				}

				isPolling = true
				try {
					const rows = await getWorkspaceRealtimeEventsAfter({
						organizationId: viewer.activeOrganizationId,
						topics: allowedTopics,
						branchIds: scopedBranchIds,
						afterId: lastSeenId,
						limit: 100,
					})

					for (const row of rows) {
						lastSeenId = row.id
						send(
							buildWorkspaceStreamMessage({
								id: String(row.id),
								data: {
									id: String(row.id),
									topic: row.topic,
									type: row.eventType,
									organizationId: row.organizationId,
									branchId: row.branchId,
									entityType: row.entityType,
									entityId: row.entityId,
									attention: row.attention,
									summary: row.summary,
									occurredAt: row.createdAt.toISOString(),
									payload: row.payloadJson,
								},
							}),
						)
					}
				} catch {
					send(
						buildWorkspaceStreamMessage({
							event: "error",
							data: { message: "Workspace realtime stream failed." },
						}),
					)
				} finally {
					isPolling = false
				}
			}

			request.signal.addEventListener("abort", close)

			send(
				buildWorkspaceStreamMessage({
					event: "ready",
					data: {
						topics: allowedTopics,
						cursor: lastSeenId,
					},
				}),
			)

			void poll()

			heartbeatInterval = setInterval(() => {
				send(
					buildWorkspaceStreamMessage({
						comment: "workspace-live-heartbeat",
					}),
				)
			}, 15_000)

			pollInterval = setInterval(() => {
				void poll()
			}, 2_500)
		},
	})

	return new Response(stream, {
		status: 200,
		headers: eventStreamHeaders,
	})
}
