"use client"

import { Clock3, Gauge, LocateFixed, Route } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { FleetMapScene } from "@/components/fleet/fleet-map-scene"
import {
	FleetOperationalPill,
	FleetRentalPill,
	FleetTelemetryPill,
} from "@/components/fleet/fleet-status-pill"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { routes } from "@/config/routes"
import { useFleetLiveStream, useFleetVehicleLiveQuery } from "@/features/fleet"
import {
	formatFleetSourceLabel,
	getFleetViewportDefaults,
} from "@/lib/fleet/live"

function formatTimestamp(value?: string | null) {
	if (!value) {
		return "-"
	}

	return new Intl.DateTimeFormat("en-AU", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value))
}

function LiveDetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="border-b border-border/70 py-3 last:border-b-0">
			<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
				{label}
			</p>
			<p className="mt-2 text-sm font-medium">{value}</p>
		</div>
	)
}

export function VehicleLiveLocationTab({
	vehicleId,
	organizationId,
}: {
	vehicleId: string
	organizationId?: string
}) {
	const [hours, setHours] = useState(1)
	const liveQuery = useFleetVehicleLiveQuery(
		organizationId,
		vehicleId,
		hours,
		Boolean(organizationId),
	)
	useFleetLiveStream(organizationId, Boolean(organizationId))

	const vehicle = liveQuery.data?.vehicle ?? null
	const defaultViewport = useMemo(
		() => liveQuery.data?.defaultViewport ?? getFleetViewportDefaults(),
		[liveQuery.data?.defaultViewport],
	)
	const mapVehicle = vehicle
		? [
				{
					id: vehicle.id,
					label: vehicle.label,
					licensePlate: vehicle.licensePlate,
					telemetryStatus: vehicle.telemetryStatus,
					isRentedNow: vehicle.isRentedNow,
					snapshot: vehicle.snapshot,
				},
			]
		: []

	return (
		<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
			<div className="min-h-[28rem] overflow-hidden rounded-[28px] border border-border/70">
				<FleetMapScene
					vehicles={mapVehicle}
					selectedVehicleId={vehicle?.id ?? null}
					trail={vehicle?.trail ?? []}
					defaultViewport={defaultViewport}
					header={
						<div className="min-w-0">
							<p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
								Live location
							</p>
							<p className="mt-1 truncate text-sm font-semibold">
								{vehicle?.label ?? "Awaiting vehicle telemetry"}
							</p>
							<p className="truncate text-xs text-muted-foreground">
								{vehicle?.snapshot
									? formatTimestamp(vehicle.snapshot.recordedAt)
									: "Default Melbourne viewport"}
							</p>
						</div>
					}
					emptyTitle="No telemetry for this vehicle"
					emptyDescription="Once a GPS device or simulator sends data, the latest location and trail will render here."
				/>
			</div>

			<div className="border border-border/70 px-5 py-5">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
					<div>
						<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Route history
						</p>
						<ToggleGroup
							type="single"
							value={String(hours)}
							onValueChange={(value) => {
								if (!value) {
									return
								}

								setHours(Number(value))
							}}
							className="mt-2 justify-start"
						>
							<ToggleGroupItem value="1">1h</ToggleGroupItem>
							<ToggleGroupItem value="6">6h</ToggleGroupItem>
							<ToggleGroupItem value="24">24h</ToggleGroupItem>
						</ToggleGroup>
					</div>

					<Button asChild variant="outline" className="rounded-full">
						<Link href={`${routes.app.fleet}?vehicle=${vehicleId}`}>
							<Route />
							Open full fleet
						</Link>
					</Button>
				</div>

				{vehicle ? (
					<>
						<div className="mt-4 flex flex-wrap gap-2">
							<FleetTelemetryPill status={vehicle.telemetryStatus} />
							<FleetOperationalPill status={vehicle.status} />
							<FleetRentalPill isRentedNow={vehicle.isRentedNow} />
						</div>

						<div className="mt-4">
							<LiveDetailRow
								label="Last seen"
								value={formatTimestamp(vehicle.snapshot?.recordedAt)}
							/>
							<LiveDetailRow
								label="Speed"
								value={
									vehicle.snapshot?.speedKph != null
										? `${Math.round(vehicle.snapshot.speedKph)} km/h`
										: "-"
								}
							/>
							<LiveDetailRow
								label="Heading"
								value={
									vehicle.snapshot?.heading != null
										? `${Math.round(vehicle.snapshot.heading)}°`
										: "-"
								}
							/>
							<LiveDetailRow
								label="Source"
								value={formatFleetSourceLabel(vehicle.snapshot?.source)}
							/>
							<LiveDetailRow
								label="Device"
								value={
									vehicle.device?.displayName ??
									vehicle.device?.externalDeviceId ??
									"No tracker linked"
								}
							/>
							<LiveDetailRow
								label="Customer"
								value={vehicle.activeRental?.customerName ?? "No active rental"}
							/>
						</div>

						<div className="mt-5 grid grid-cols-3 gap-3 border-t border-border/70 pt-4 text-center">
							<div>
								<div className="flex justify-center text-muted-foreground">
									<LocateFixed className="size-4" />
								</div>
								<p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
									Accuracy
								</p>
								<p className="mt-1 text-sm font-semibold">
									{vehicle.snapshot?.accuracyMeters != null
										? `${Math.round(vehicle.snapshot.accuracyMeters)}m`
										: "-"}
								</p>
							</div>
							<div>
								<div className="flex justify-center text-muted-foreground">
									<Gauge className="size-4" />
								</div>
								<p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
									Track points
								</p>
								<p className="mt-1 text-sm font-semibold">
									{vehicle.trail.length}
								</p>
							</div>
							<div>
								<div className="flex justify-center text-muted-foreground">
									<Clock3 className="size-4" />
								</div>
								<p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
									Freshness
								</p>
								<p className="mt-1 text-sm font-semibold">
									{vehicle.snapshot?.freshnessSeconds != null
										? `${vehicle.snapshot.freshnessSeconds}s`
										: "-"}
								</p>
							</div>
						</div>
					</>
				) : (
					<div className="py-10 text-sm text-muted-foreground">
						{liveQuery.isPending
							? "Loading live telemetry..."
							: "This vehicle has no live telemetry data yet."}
					</div>
				)}
			</div>
		</div>
	)
}
