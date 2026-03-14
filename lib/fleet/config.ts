const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/bright"

function parseNumber(value: string | undefined, fallback: number) {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : fallback
}

export const fleetMapDefaults = {
	styleUrl: process.env.NEXT_PUBLIC_FLEET_MAP_STYLE_URL ?? DEFAULT_STYLE_URL,
	center: {
		lng: parseNumber(process.env.NEXT_PUBLIC_FLEET_MAP_CENTER_LNG, 144.9631),
		lat: parseNumber(process.env.NEXT_PUBLIC_FLEET_MAP_CENTER_LAT, -37.8136),
	},
	zoom: parseNumber(process.env.NEXT_PUBLIC_FLEET_MAP_ZOOM, 10.5),
	selectedZoom: parseNumber(
		process.env.NEXT_PUBLIC_FLEET_MAP_SELECTED_ZOOM,
		14.5,
	),
	pitch: parseNumber(process.env.NEXT_PUBLIC_FLEET_MAP_PITCH, 55),
	bearing: parseNumber(process.env.NEXT_PUBLIC_FLEET_MAP_BEARING, -20),
}

export const telemetryGatewayConfig = {
	baseUrl: process.env.TELEMETRY_GATEWAY_URL ?? "",
	token: process.env.TELEMETRY_GATEWAY_TOKEN ?? "",
}
