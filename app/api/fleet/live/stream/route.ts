import { requireViewer } from "@/lib/api/guards"
import { isPrivilegedFleetViewerRole } from "@/lib/authorization/server"
import { telemetryGatewayConfig } from "@/lib/fleet/config"

const eventStreamHeaders = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache, no-transform",
	Connection: "keep-alive",
}

function createStreamMessage(body: string, status = 200) {
	return new Response(body, {
		status,
		headers: eventStreamHeaders,
	})
}

export async function GET() {
	const guard = await requireViewer({ permission: "viewFleetModule" })

	if (guard.response) {
		return guard.response
	}

	if (!isPrivilegedFleetViewerRole(guard.viewer.role)) {
		return createStreamMessage(
			'event: error\ndata: {"message":"Forbidden."}\n\n',
			403,
		)
	}

	if (!telemetryGatewayConfig.baseUrl) {
		return createStreamMessage(": telemetry gateway not configured\n\n")
	}

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 10_000)

	try {
		const upstream = await fetch(
			`${telemetryGatewayConfig.baseUrl.replace(/\/$/, "")}/stream?organizationId=${encodeURIComponent(guard.viewer.activeOrganizationId)}`,
			{
				headers: {
					Accept: "text/event-stream",
					...(telemetryGatewayConfig.token
						? {
								Authorization: `Bearer ${telemetryGatewayConfig.token}`,
							}
						: {}),
				},
				signal: controller.signal,
				cache: "no-store",
			},
		)

		clearTimeout(timeout)

		if (!upstream.ok || !upstream.body) {
			return createStreamMessage(": telemetry gateway unavailable\n\n", 502)
		}

		return new Response(upstream.body, {
			status: 200,
			headers: eventStreamHeaders,
		})
	} catch {
		clearTimeout(timeout)
		return createStreamMessage(": telemetry gateway unavailable\n\n", 502)
	}
}
