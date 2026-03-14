"use client"

import { Building2, Crosshair, Radar } from "lucide-react"
import type MapLibreGL from "maplibre-gl"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"

import {
	Map as FleetMap,
	MapControls,
	MapRoute,
	type MapViewport,
	useMap,
} from "@/components/ui/map"
import type {
	FleetLiveSnapshot,
	FleetPositionPoint,
} from "@/features/fleet/types/fleet"
import { cn } from "@/lib/utils"

type FleetMapVehicle = {
	id: string
	label: string
	licensePlate: string
	telemetryStatus: "moving" | "parked" | "offline" | "no_data"
	isRentedNow: boolean
	snapshot: FleetLiveSnapshot | null
}

type FleetMapSceneProps = {
	vehicles: FleetMapVehicle[]
	selectedVehicleId?: string | null
	onSelectVehicle?: (vehicleId: string) => void
	trail?: FleetPositionPoint[]
	header: ReactNode
	className?: string
	defaultViewport: {
		center: [number, number]
		zoom: number
		selectedZoom: number
		pitch: number
		bearing: number
		styleUrl: string
	}
	emptyTitle?: string
	emptyDescription?: string
	chromeStyle?: "elevated" | "flat"
}

const EMPTY_TRAIL: FleetPositionPoint[] = []
const EMPTY_VEHICLE_FEATURE_COLLECTION: FleetVehicleFeatureCollection = {
	type: "FeatureCollection",
	features: [],
}
const VEHICLE_ANIMATION_DURATION_MS = 900
const MAX_ANIMATED_JUMP_METERS = 1_200

type FleetVehicleFeatureProperties = {
	vehicleId: string
	label: string
	licensePlate: string
	telemetryStatus: FleetMapVehicle["telemetryStatus"]
	isSelected: boolean
	isRentedNow: boolean
}

type FleetVehicleFeature = GeoJSON.Feature<
	GeoJSON.Point,
	FleetVehicleFeatureProperties
>

type FleetVehicleFeatureCollection = GeoJSON.FeatureCollection<
	GeoJSON.Point,
	FleetVehicleFeatureProperties
>

const VIBRANT_MAP_COLORS = {
	background: "#f4f4f5",
	backgroundSoft: "#fff7ed",
	water: "#3b82f6",
	waterLine: "#0ea5e9",
	park: "#22c55e",
	parkSoft: "#a3e635",
	roadMajor: "#9ca3af",
	roadSecondary: "#d1d5db",
	roadMinor: "#d1d5db",
	roadPath: "#f3f4f6",
	boundary: "#a3b1bd",
	label: "#12212b",
	labelSoft: "#475569",
	labelHalo: "#f7fafb",
	route: "#2563eb",
	moving: "#22c55e",
	movingHalo: "#4ade80",
	parked: "#16a34a",
	parkedHalo: "#22c55e",
	offline: "#64748b",
	offlineHalo: "#94a3b8",
	noData: "#94a3b8",
	noDataHalo: "#cbd5e1",
	selectedStroke: "#f8fbfc",
	buildingBase: "#ffedd5",
	buildingLine: "#cbd5e1",
	buildingLow: "#ffffff",
	buildingMid: "#f1f5f9",
	buildingHigh: "#e2e8f0",
} as const

const MAP_GLASS_PANEL_CLASS =
	"border border-white/75 bg-[rgba(247,250,251,0.88)] text-slate-950 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.28)] backdrop-blur-xl"

type PaintPropertyName = Parameters<MapLibreGL.Map["setPaintProperty"]>[1]
type PaintPropertyValue = Parameters<MapLibreGL.Map["setPaintProperty"]>[2]

function easeOutCubic(progress: number) {
	return 1 - (1 - progress) ** 3
}

function interpolateCoordinates(
	from: [number, number],
	to: [number, number],
	progress: number,
): [number, number] {
	return [
		from[0] + (to[0] - from[0]) * progress,
		from[1] + (to[1] - from[1]) * progress,
	]
}

function getApproxDistanceMeters(from: [number, number], to: [number, number]) {
	const lngDeltaMeters =
		(to[0] - from[0]) *
		111_320 *
		Math.cos((((from[1] + to[1]) / 2) * Math.PI) / 180)
	const latDeltaMeters = (to[1] - from[1]) * 110_540

	return Math.hypot(lngDeltaMeters, latDeltaMeters)
}

function getFeatureCoordinates(feature: FleetVehicleFeature): [number, number] {
	return feature.geometry.coordinates as [number, number]
}

function cloneFeatureWithCoordinates(
	feature: FleetVehicleFeature,
	coordinates: [number, number],
): FleetVehicleFeature {
	return {
		...feature,
		geometry: {
			...feature.geometry,
			coordinates,
		},
	}
}

function shouldAnimateVehicleMovement(
	from: FleetVehicleFeature,
	to: FleetVehicleFeature,
) {
	if (to.properties.telemetryStatus !== "moving") {
		return false
	}

	return (
		getApproxDistanceMeters(
			getFeatureCoordinates(from),
			getFeatureCoordinates(to),
		) <= MAX_ANIMATED_JUMP_METERS
	)
}

function tryGetLayer(map: MapLibreGL.Map, layerId: string) {
	try {
		return map.getLayer(layerId)
	} catch {
		return undefined
	}
}

function tryRemoveLayer(map: MapLibreGL.Map, layerId: string) {
	try {
		if (tryGetLayer(map, layerId)) {
			map.removeLayer(layerId)
		}
	} catch {
		// The map can already be tearing down during route transitions.
	}
}

function trySetPaintProperty(
	map: MapLibreGL.Map,
	layerId: string,
	property: PaintPropertyName,
	value: PaintPropertyValue,
) {
	try {
		map.setPaintProperty(layerId, property, value)
	} catch {
		// Ignore provider/style differences across compatible basemaps.
	}
}

function trySetLight(
	map: MapLibreGL.Map,
	light: MapLibreGL.LightSpecification,
) {
	try {
		map.setLight(light)
	} catch {
		// Some styles/providers may not expose lighting hooks consistently.
	}
}

function tryOff(
	map: MapLibreGL.Map,
	event: string,
	listener: Parameters<MapLibreGL.Map["off"]>[1],
) {
	try {
		map.off(event, listener)
	} catch {
		// Ignore cleanup races while the map is disposing.
	}
}

function getSourceLayer(
	layer: MapLibreGL.LayerSpecification,
): string | undefined {
	return "source-layer" in layer ? layer["source-layer"] : undefined
}

function applyVibrantBasemapTheme(map: MapLibreGL.Map) {
	let layers: MapLibreGL.LayerSpecification[] = []

	try {
		layers = map.getStyle().layers ?? []
	} catch {
		return
	}

	for (const layer of layers) {
		const sourceLayer = getSourceLayer(layer)
		const layerId = layer.id.toLowerCase()

		if (layer.type === "background") {
			trySetPaintProperty(
				map,
				layer.id,
				"background-color",
				VIBRANT_MAP_COLORS.background,
			)
			continue
		}

		if (layer.type === "fill" && sourceLayer === "water") {
			trySetPaintProperty(map, layer.id, "fill-color", VIBRANT_MAP_COLORS.water)
			trySetPaintProperty(map, layer.id, "fill-opacity", 0.84)
			continue
		}

		if (layer.type === "line" && sourceLayer === "waterway") {
			trySetPaintProperty(
				map,
				layer.id,
				"line-color",
				VIBRANT_MAP_COLORS.waterLine,
			)
			trySetPaintProperty(map, layer.id, "line-opacity", 0.88)
			continue
		}

		if (
			layer.type === "fill" &&
			(sourceLayer === "landcover" || sourceLayer === "landuse") &&
			/(park|grass|green|wood|forest|pitch|cemetery|golf)/.test(layerId)
		) {
			trySetPaintProperty(map, layer.id, "fill-color", [
				"case",
				["match", ["get", "class"], ["wood", "forest"], true, false],
				VIBRANT_MAP_COLORS.parkSoft,
				VIBRANT_MAP_COLORS.park,
			] as PaintPropertyValue)
			trySetPaintProperty(map, layer.id, "fill-opacity", 0.58)
			continue
		}

		if (layer.type === "line" && sourceLayer === "transportation") {
			trySetPaintProperty(map, layer.id, "line-color", [
				"match",
				["coalesce", ["get", "class"], ["get", "subclass"], ""],
				["motorway", "trunk", "primary"],
				VIBRANT_MAP_COLORS.roadMajor,
				["secondary", "tertiary"],
				VIBRANT_MAP_COLORS.roadSecondary,
				["residential", "service", "street"],
				VIBRANT_MAP_COLORS.roadMinor,
				["path", "track", "pedestrian"],
				VIBRANT_MAP_COLORS.roadPath,
				VIBRANT_MAP_COLORS.roadMinor,
			] as PaintPropertyValue)
			trySetPaintProperty(map, layer.id, "line-opacity", 0.92)
			continue
		}

		if (layer.type === "fill" && sourceLayer === "building") {
			trySetPaintProperty(
				map,
				layer.id,
				"fill-color",
				VIBRANT_MAP_COLORS.buildingBase,
			)
			trySetPaintProperty(map, layer.id, "fill-opacity", 0.56)
			continue
		}

		if (layer.type === "line" && sourceLayer === "building") {
			trySetPaintProperty(
				map,
				layer.id,
				"line-color",
				VIBRANT_MAP_COLORS.buildingLine,
			)
			trySetPaintProperty(map, layer.id, "line-opacity", 0.42)
			continue
		}

		if (layer.type === "line" && sourceLayer === "boundary") {
			trySetPaintProperty(
				map,
				layer.id,
				"line-color",
				VIBRANT_MAP_COLORS.boundary,
			)
			trySetPaintProperty(map, layer.id, "line-opacity", 0.3)
			continue
		}

		if (layer.type === "symbol") {
			if (
				sourceLayer &&
				["place", "transportation_name", "poi", "water_name"].includes(
					sourceLayer,
				)
			) {
				trySetPaintProperty(
					map,
					layer.id,
					"text-color",
					VIBRANT_MAP_COLORS.label,
				)
				trySetPaintProperty(
					map,
					layer.id,
					"text-halo-color",
					VIBRANT_MAP_COLORS.labelHalo,
				)
				trySetPaintProperty(map, layer.id, "text-halo-width", 1.4)
				trySetPaintProperty(map, layer.id, "text-opacity", 0.94)
				trySetPaintProperty(map, layer.id, "icon-opacity", 0.78)
				continue
			}

			if (/(road|street|highway|motorway)/.test(layerId)) {
				trySetPaintProperty(
					map,
					layer.id,
					"text-color",
					VIBRANT_MAP_COLORS.labelSoft,
				)
				trySetPaintProperty(
					map,
					layer.id,
					"text-halo-color",
					VIBRANT_MAP_COLORS.labelHalo,
				)
				trySetPaintProperty(map, layer.id, "text-halo-width", 1.2)
			}
		}
	}

	trySetLight(map, {
		anchor: "viewport",
		color: "#ffffff",
		intensity: 0.34,
		position: [1.15, 190, 52],
	})
}

function FleetMapStyleController() {
	const { map, isLoaded } = useMap()

	useEffect(() => {
		if (!map || !isLoaded) {
			return
		}

		const applyTheme = () => {
			applyVibrantBasemapTheme(map)
		}

		applyTheme()
		map.on("styledata", applyTheme)

		return () => {
			tryOff(map, "styledata", applyTheme)
		}
	}, [isLoaded, map])

	return null
}

function FleetVehicleLayer({
	vehicles,
	selectedVehicleId,
	onSelectVehicle,
}: {
	vehicles: FleetMapVehicle[]
	selectedVehicleId?: string | null
	onSelectVehicle?: (vehicleId: string) => void
}) {
	const { map, isLoaded } = useMap()
	const sourceId = "fleet-vehicles-source"
	const haloLayerId = "fleet-vehicles-halo"
	const pointLayerId = "fleet-vehicles-points"
	const labelLayerId = "fleet-vehicles-labels"
	const animationFrameRef = useRef<number | null>(null)
	const displayedFeaturesRef = useRef<FleetVehicleFeatureCollection>(
		EMPTY_VEHICLE_FEATURE_COLLECTION,
	)

	const featureCollection = useMemo<FleetVehicleFeatureCollection>(() => {
		return {
			type: "FeatureCollection",
			features: vehicles.flatMap((vehicle) => {
				if (!vehicle.snapshot) {
					return []
				}

				return [
					{
						type: "Feature",
						geometry: {
							type: "Point",
							coordinates: [
								vehicle.snapshot.longitude,
								vehicle.snapshot.latitude,
							],
						},
						properties: {
							vehicleId: vehicle.id,
							label: vehicle.label,
							licensePlate: vehicle.licensePlate,
							telemetryStatus: vehicle.telemetryStatus,
							isSelected: vehicle.id === selectedVehicleId,
							isRentedNow: vehicle.isRentedNow,
						},
					},
				]
			}),
		}
	}, [selectedVehicleId, vehicles])

	useEffect(() => {
		if (!isLoaded || !map) {
			return
		}

		if (!map.getSource(sourceId)) {
			map.addSource(sourceId, {
				type: "geojson",
				data: displayedFeaturesRef.current,
			})
		}

		if (!map.getLayer(haloLayerId)) {
			map.addLayer({
				id: haloLayerId,
				type: "circle",
				source: sourceId,
				paint: {
					"circle-radius": [
						"case",
						["get", "isSelected"],
						24,
						["get", "isRentedNow"],
						18,
						14,
					],
					"circle-color": [
						"match",
						["get", "telemetryStatus"],
						"moving",
						VIBRANT_MAP_COLORS.movingHalo,
						"parked",
						VIBRANT_MAP_COLORS.parkedHalo,
						"offline",
						VIBRANT_MAP_COLORS.offlineHalo,
						VIBRANT_MAP_COLORS.noDataHalo,
					],
					"circle-opacity": 0.3,
					"circle-blur": 0.65,
				},
			})
		}

		if (!map.getLayer(pointLayerId)) {
			map.addLayer({
				id: pointLayerId,
				type: "circle",
				source: sourceId,
				paint: {
					"circle-radius": [
						"case",
						["get", "isSelected"],
						9.5,
						["get", "isRentedNow"],
						7.5,
						6,
					],
					"circle-color": [
						"match",
						["get", "telemetryStatus"],
						"moving",
						VIBRANT_MAP_COLORS.moving,
						"parked",
						VIBRANT_MAP_COLORS.parked,
						"offline",
						VIBRANT_MAP_COLORS.offline,
						VIBRANT_MAP_COLORS.noData,
					],
					"circle-stroke-width": ["case", ["get", "isSelected"], 3.2, 2.2],
					"circle-stroke-color": VIBRANT_MAP_COLORS.selectedStroke,
				},
			})
		}

		if (!map.getLayer(labelLayerId)) {
			map.addLayer({
				id: labelLayerId,
				type: "symbol",
				source: sourceId,
				minzoom: 11,
				layout: {
					"text-field": ["get", "licensePlate"],
					"text-size": 11,
					"text-offset": [0, 1.6],
					"text-anchor": "top",
				},
				paint: {
					"text-color": VIBRANT_MAP_COLORS.label,
					"text-halo-color": VIBRANT_MAP_COLORS.labelHalo,
					"text-halo-width": 1.1,
				},
			})
		}

		const handleClick = (event: MapLibreGL.MapLayerMouseEvent) => {
			const feature = event.features?.[0]
			const vehicleId = feature?.properties?.vehicleId
			if (typeof vehicleId === "string") {
				onSelectVehicle?.(vehicleId)
			}
		}

		const handleMouseEnter = () => {
			map.getCanvas().style.cursor = "pointer"
		}

		const handleMouseLeave = () => {
			map.getCanvas().style.cursor = ""
		}

		map.on("click", pointLayerId, handleClick)
		map.on("mouseenter", pointLayerId, handleMouseEnter)
		map.on("mouseleave", pointLayerId, handleMouseLeave)

		return () => {
			if (animationFrameRef.current != null) {
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = null
			}

			try {
				map.off("click", pointLayerId, handleClick)
				map.off("mouseenter", pointLayerId, handleMouseEnter)
				map.off("mouseleave", pointLayerId, handleMouseLeave)
			} catch {
				// Ignore cleanup races while the map is disposing.
			}
		}
	}, [isLoaded, map, onSelectVehicle])

	useEffect(() => {
		if (!isLoaded || !map) {
			return
		}

		const source = map.getSource(sourceId) as
			| MapLibreGL.GeoJSONSource
			| undefined
		if (!source) {
			return
		}

		if (animationFrameRef.current != null) {
			cancelAnimationFrame(animationFrameRef.current)
			animationFrameRef.current = null
		}

		const currentById = new Map(
			displayedFeaturesRef.current.features.map((feature) => [
				feature.properties.vehicleId,
				feature,
			]),
		)
		const animatedTargets = featureCollection.features
			.map((feature) => {
				const previousFeature = currentById.get(feature.properties.vehicleId)
				if (
					!previousFeature ||
					!shouldAnimateVehicleMovement(previousFeature, feature)
				) {
					return null
				}

				return {
					feature,
					from: getFeatureCoordinates(previousFeature),
					to: getFeatureCoordinates(feature),
				}
			})
			.filter((value): value is NonNullable<typeof value> => value !== null)

		if (animatedTargets.length === 0) {
			displayedFeaturesRef.current = featureCollection
			source.setData(featureCollection)
			return
		}

		const animationStartedAt = performance.now()

		const step = (timestamp: number) => {
			const progress = Math.min(
				(timestamp - animationStartedAt) / VEHICLE_ANIMATION_DURATION_MS,
				1,
			)
			const easedProgress = easeOutCubic(progress)
			const animatedById = new Map(
				animatedTargets.map((entry) => [
					entry.feature.properties.vehicleId,
					cloneFeatureWithCoordinates(
						entry.feature,
						interpolateCoordinates(entry.from, entry.to, easedProgress),
					),
				]),
			)
			const nextFrame: FleetVehicleFeatureCollection = {
				type: "FeatureCollection",
				features: featureCollection.features.map(
					(feature) =>
						animatedById.get(feature.properties.vehicleId) ?? feature,
				),
			}

			displayedFeaturesRef.current = nextFrame
			source.setData(nextFrame)

			if (progress < 1) {
				animationFrameRef.current = requestAnimationFrame(step)
				return
			}

			displayedFeaturesRef.current = featureCollection
			source.setData(featureCollection)
			animationFrameRef.current = null
		}

		animationFrameRef.current = requestAnimationFrame(step)

		return () => {
			if (animationFrameRef.current != null) {
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = null
			}
		}
	}, [featureCollection, isLoaded, map])

	return null
}

function FleetSelectedVehicleCameraController({
	snapshot,
	enabled,
}: {
	snapshot: FleetLiveSnapshot | null
	enabled: boolean
}) {
	const { map, isLoaded } = useMap()
	const previousCoordinatesRef = useRef<[number, number] | null>(null)

	useEffect(() => {
		if (!map || !isLoaded || !snapshot) {
			return
		}

		const nextCoordinates: [number, number] = [
			snapshot.longitude,
			snapshot.latitude,
		]
		const previousCoordinates = previousCoordinatesRef.current
		previousCoordinatesRef.current = nextCoordinates

		if (!previousCoordinates) {
			return
		}

		if (
			previousCoordinates[0] === nextCoordinates[0] &&
			previousCoordinates[1] === nextCoordinates[1]
		) {
			return
		}

		if (!enabled) {
			return
		}

		if (
			getApproxDistanceMeters(previousCoordinates, nextCoordinates) >
			MAX_ANIMATED_JUMP_METERS
		) {
			map.jumpTo({ center: nextCoordinates })
			return
		}

		map.easeTo({
			center: nextCoordinates,
			duration: VEHICLE_ANIMATION_DURATION_MS,
			essential: true,
		})
	}, [enabled, isLoaded, map, snapshot])

	return null
}

function Fleet3DBuildings({ enabled }: { enabled: boolean }) {
	const { map, isLoaded } = useMap()
	const layerId = "fleet-3d-buildings"

	useEffect(() => {
		if (!map || !isLoaded) {
			return
		}

		const syncLayer = () => {
			if (!enabled) {
				tryRemoveLayer(map, layerId)
				return
			}

			const style = map.getStyle()
			const vectorSourceId = Object.entries(style.sources).find(
				([, source]) => source.type === "vector",
			)?.[0]

			if (!vectorSourceId || tryGetLayer(map, layerId)) {
				return
			}

			const beforeLayerId = style.layers?.find(
				(layer) => layer.type === "symbol",
			)?.id

			try {
				map.addLayer(
					{
						id: layerId,
						type: "fill-extrusion",
						source: vectorSourceId,
						"source-layer": "building",
						minzoom: 14,
						paint: {
							"fill-extrusion-color": [
								"interpolate",
								["linear"],
								["coalesce", ["get", "render_height"], ["get", "height"], 10],
								0,
								VIBRANT_MAP_COLORS.buildingLow,
								80,
								VIBRANT_MAP_COLORS.buildingMid,
								240,
								VIBRANT_MAP_COLORS.buildingHigh,
							],
							"fill-extrusion-opacity": 0.76,
							"fill-extrusion-height": [
								"coalesce",
								["get", "render_height"],
								["get", "height"],
								10,
							],
							"fill-extrusion-base": [
								"coalesce",
								["get", "render_min_height"],
								["get", "min_height"],
								0,
							],
							"fill-extrusion-vertical-gradient": true,
						},
					},
					beforeLayerId,
				)
			} catch {
				// Some public styles don't expose a compatible building layer.
			}
		}

		syncLayer()
		map.on("styledata", syncLayer)

		return () => {
			tryOff(map, "styledata", syncLayer)
			tryRemoveLayer(map, layerId)
		}
	}, [enabled, isLoaded, map])

	return null
}

export function FleetMapScene({
	vehicles,
	selectedVehicleId,
	onSelectVehicle,
	trail = EMPTY_TRAIL,
	header,
	className,
	defaultViewport,
	emptyTitle = "No live telemetry yet",
	emptyDescription = "Vehicles will appear here as soon as GPS data starts arriving.",
	chromeStyle = "elevated",
}: FleetMapSceneProps) {
	const [isThreeD, setIsThreeD] = useState(true)
	const [viewport, setViewport] = useState<MapViewport>(() => ({
		center: defaultViewport.center,
		zoom: defaultViewport.zoom,
		bearing: 0,
		pitch: 0,
	}))
	const [recenterToken, setRecenterToken] = useState(0)
	const lastFocusKeyRef = useRef("")

	const selectedVehicle =
		vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
		vehicles.find((vehicle) => vehicle.snapshot) ??
		null
	const selectedSnapshot = selectedVehicle?.snapshot ?? null
	const mapGlassPanelClass =
		chromeStyle === "flat"
			? "border border-white/70 bg-[rgba(247,250,251,0.92)] text-slate-950 backdrop-blur-xl"
			: MAP_GLASS_PANEL_CLASS
	const mapControlsClassName =
		chromeStyle === "flat"
			? "[&>div]:overflow-hidden [&>div]:rounded-[12px] [&>div]:border-white/75 [&>div]:bg-[rgba(247,250,251,0.92)] [&_button]:text-slate-800 [&_button]:hover:bg-slate-900/6 [&_svg]:text-slate-700"
			: "[&>div]:overflow-hidden [&>div]:rounded-[18px] [&>div]:border-white/75 [&>div]:bg-[rgba(247,250,251,0.88)] [&>div]:shadow-[0_20px_44px_-30px_rgba(15,23,42,0.24)] [&_button]:text-slate-800 [&_button]:hover:bg-slate-900/6 [&_svg]:text-slate-700"
	const emptyStateClassName =
		chromeStyle === "flat"
			? "max-w-sm rounded-[16px] border border-dashed border-slate-300/80 bg-[rgba(247,250,251,0.94)] px-6 py-5 text-center text-slate-950 backdrop-blur-xl [&_.text-muted-foreground]:text-slate-500"
			: "max-w-sm rounded-[28px] border border-dashed border-slate-300/80 bg-[rgba(247,250,251,0.9)] px-6 py-5 text-center text-slate-950 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.22)] backdrop-blur-xl [&_.text-muted-foreground]:text-slate-500"
	const routeCoordinates = trail.map((point) => [
		point.longitude,
		point.latitude,
	]) as [number, number][]

	useEffect(() => {
		const focusKey = [
			selectedVehicle?.id ?? "default",
			isThreeD ? "3d" : "2d",
			recenterToken,
		].join(":")

		if (focusKey === lastFocusKeyRef.current) {
			return
		}

		lastFocusKeyRef.current = focusKey
		setViewport((current) => ({
			...current,
			center: selectedSnapshot
				? [selectedSnapshot.longitude, selectedSnapshot.latitude]
				: defaultViewport.center,
			zoom: selectedSnapshot
				? defaultViewport.selectedZoom
				: defaultViewport.zoom,
			pitch: isThreeD ? defaultViewport.pitch : 0,
			bearing: isThreeD ? defaultViewport.bearing : 0,
		}))
	}, [
		defaultViewport,
		isThreeD,
		recenterToken,
		selectedSnapshot,
		selectedVehicle?.id,
	])

	return (
		<div
			className={cn("relative h-full min-h-[24rem] overflow-hidden", className)}
		>
			<FleetMap
				className="h-full w-full"
				viewport={viewport}
				onViewportChange={setViewport}
				dragRotate
				touchPitch
				doubleClickZoom
				maxZoom={18}
				minZoom={3}
				styles={{
					light: defaultViewport.styleUrl,
					dark: defaultViewport.styleUrl,
				}}
			>
				<FleetMapStyleController />
				<FleetVehicleLayer
					vehicles={vehicles}
					selectedVehicleId={selectedVehicleId}
					onSelectVehicle={onSelectVehicle}
				/>
				<FleetSelectedVehicleCameraController
					snapshot={selectedSnapshot}
					enabled={selectedVehicle?.telemetryStatus === "moving"}
				/>
				<Fleet3DBuildings enabled={isThreeD} />
				{routeCoordinates.length > 1 ? (
					<>
						<MapRoute
							id="fleet-selected-trail-shadow"
							coordinates={routeCoordinates}
							color="#dbe7ff"
							width={8}
							opacity={0.7}
						/>
						<MapRoute
							id="fleet-selected-trail"
							coordinates={routeCoordinates}
							color={VIBRANT_MAP_COLORS.route}
							width={4.5}
							opacity={0.96}
						/>
					</>
				) : null}
				<MapControls
					position="bottom-right"
					showZoom
					showCompass
					showFullscreen
					className={mapControlsClassName}
				/>
			</FleetMap>

			<div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
				<div
					className={cn(
						"pointer-events-auto flex min-w-0 flex-1 items-center gap-3 rounded-[14px] px-4 py-3 [&_.text-muted-foreground]:text-slate-500 [&_.text-primary]:text-sky-700",
						mapGlassPanelClass,
					)}
				>
					<Radar className="size-4 shrink-0 text-primary" />
					<div className="min-w-0 flex-1">{header}</div>
				</div>
				<div
					className={cn(
						"pointer-events-auto flex items-center gap-2 rounded-[12px] p-1.5",
						mapGlassPanelClass,
					)}
				>
					<button
						type="button"
						onClick={() => setIsThreeD((value) => !value)}
						className={cn(
							"inline-flex h-10 items-center gap-2 rounded-[16px] px-3 text-sm font-medium transition",
							isThreeD
								? "bg-slate-800 text-white hover:bg-slate-700"
								: "text-slate-700 hover:bg-slate-900/6",
						)}
					>
						<Building2 className="size-4" />
						{isThreeD ? "3D on" : "2D"}
					</button>
					<button
						type="button"
						onClick={() => setRecenterToken((value) => value + 1)}
						className="inline-flex h-10 items-center gap-2 rounded-[16px] px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-900/6"
					>
						<Crosshair className="size-4" />
						Recenter
					</button>
				</div>
			</div>

			{selectedVehicle ? (
				<div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex">
					<div
						className={cn(
							"rounded-[14px] px-4 py-3 [&_.text-muted-foreground]:text-slate-500",
							mapGlassPanelClass,
						)}
					>
						<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Focused vehicle
						</p>
						<p className="mt-1 max-w-[18rem] truncate text-sm font-semibold text-slate-950">
							{selectedVehicle.label}
						</p>
						<p className="text-xs text-muted-foreground">
							{selectedVehicle.licensePlate}
						</p>
					</div>
				</div>
			) : (
				<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
					<div className={cn(emptyStateClassName)}>
						<p className="text-sm font-semibold text-slate-950">{emptyTitle}</p>
						<p className="mt-2 text-sm text-muted-foreground">
							{emptyDescription}
						</p>
					</div>
				</div>
			)}
		</div>
	)
}
