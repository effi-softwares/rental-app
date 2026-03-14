"use client"

import { CarFront, Menu, Search, Signal } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
	startTransition,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from "react"

import { FleetMapScene } from "@/components/fleet/fleet-map-scene"
import {
	FleetOperationalPill,
	FleetRentalPill,
	FleetTelemetryPill,
} from "@/components/fleet/fleet-status-pill"
import { MediaImage } from "@/components/media/media-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { routes } from "@/config/routes"
import type { FleetLiveResponse } from "@/features/fleet"
import { useFleetLiveQuery, useFleetLiveStream } from "@/features/fleet"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { getFleetViewportDefaults } from "@/lib/fleet/live"
import { cn } from "@/lib/utils"

function formatLastSeen(value?: string | null) {
	if (!value) {
		return "No fix"
	}

	return new Intl.DateTimeFormat("en-AU", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value))
}

function FleetRail({
	vehicles,
	selectedVehicleId,
	onSelectVehicle,
	search,
	onSearchChange,
}: {
	vehicles: FleetLiveResponse["vehicles"]
	selectedVehicleId?: string | null
	onSelectVehicle: (vehicleId: string) => void
	search: string
	onSearchChange: (value: string) => void
}) {
	const summary = useMemo(() => {
		const rented = vehicles.filter((vehicle) => vehicle.isRentedNow).length
		const moving = vehicles.filter(
			(vehicle) => vehicle.telemetryStatus === "moving",
		).length
		const parked = vehicles.filter(
			(vehicle) => vehicle.telemetryStatus === "parked",
		).length

		return { rented, moving, parked }
	}, [vehicles])

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-border/70 px-5 py-5">
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
							Owner control
						</p>
						<h1 className="mt-1 text-2xl font-semibold tracking-tight">
							Fleet live
						</h1>
					</div>
					<Button asChild variant="ghost" className="rounded-full px-3">
						<Link href={routes.app.vehicleCatalog}>Catalog</Link>
					</Button>
				</div>
				<div className="mt-4 grid grid-cols-3 gap-3 border-y border-border/70 py-4">
					<div>
						<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
							Rented
						</p>
						<p className="mt-2 text-2xl font-semibold">{summary.rented}</p>
					</div>
					<div>
						<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
							Moving
						</p>
						<p className="mt-2 text-2xl font-semibold">{summary.moving}</p>
					</div>
					<div>
						<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
							Parked
						</p>
						<p className="mt-2 text-2xl font-semibold">{summary.parked}</p>
					</div>
				</div>
				<div className="relative mt-4">
					<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Search by plate, vehicle, customer, or device"
						className="h-12 rounded-2xl border-border/70 pl-10"
					/>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{vehicles.length === 0 ? (
					<div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
						No vehicles match the current filter.
					</div>
				) : (
					<div className="divide-y divide-border/70">
						{vehicles.map((vehicle) => (
							<button
								key={vehicle.id}
								type="button"
								onClick={() => onSelectVehicle(vehicle.id)}
								className={cn(
									"flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-muted/40",
									selectedVehicleId === vehicle.id && "bg-primary/5",
								)}
							>
								<div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-[22px] border border-border/70">
									{vehicle.frontImage ? (
										<MediaImage
											asset={{
												id: vehicle.frontImage.assetId,
												deliveryUrl: vehicle.frontImage.deliveryUrl,
												visibility: "private",
												blurDataUrl: vehicle.frontImage.blurDataUrl,
												originalFileName: `${vehicle.label}.jpg`,
												contentType: "image/jpeg",
											}}
											alt={vehicle.label}
											fill
											sizes="64px"
											className="object-cover"
										/>
									) : (
										<div className="flex size-full items-center justify-center text-muted-foreground">
											<CarFront className="size-5" />
										</div>
									)}
								</div>

								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="truncate text-sm font-semibold">
											{vehicle.label}
										</p>
										<FleetRentalPill isRentedNow={vehicle.isRentedNow} />
									</div>
									<div className="mt-2 flex flex-wrap items-center gap-2">
										<FleetTelemetryPill status={vehicle.telemetryStatus} />
										<FleetOperationalPill status={vehicle.status} />
									</div>
									<p className="mt-3 text-sm text-muted-foreground">
										{vehicle.licensePlate}
										{vehicle.activeRental?.customerName
											? ` • ${vehicle.activeRental.customerName}`
											: ""}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{vehicle.snapshot
											? `Last seen ${formatLastSeen(vehicle.snapshot.recordedAt)}`
											: "Waiting for first telemetry fix"}
									</p>
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export function FleetLiveManagement() {
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const liveQuery = useFleetLiveQuery(activeOrganizationId)
	useFleetLiveStream(activeOrganizationId, Boolean(activeOrganizationId))

	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()

	const [search, setSearch] = useState("")
	const deferredSearch = useDeferredValue(search)
	const [isRailOpen, setIsRailOpen] = useState(false)

	const vehicles = liveQuery.data?.vehicles ?? []
	const selectedFromUrl = searchParams.get("vehicle")
	const urlSelectedVehicle = vehicles.find(
		(vehicle) => vehicle.id === selectedFromUrl,
	)
	const firstLiveVehicle = vehicles.find((vehicle) => vehicle.snapshot)
	const preferredVehicleId = urlSelectedVehicle?.snapshot
		? selectedFromUrl
		: (firstLiveVehicle?.id ??
			urlSelectedVehicle?.id ??
			vehicles[0]?.id ??
			null)
	const selectedVehicleId = preferredVehicleId
	const selectedVehicle =
		vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null

	useEffect(() => {
		if (!selectedVehicleId) {
			return
		}

		if (selectedFromUrl === selectedVehicleId) {
			return
		}

		const params = new URLSearchParams(searchParams.toString())
		params.set("vehicle", selectedVehicleId)
		startTransition(() => {
			router.replace(`${pathname}?${params.toString()}`, { scroll: false })
		})
	}, [pathname, router, searchParams, selectedFromUrl, selectedVehicleId])

	const filteredVehicles = useMemo(() => {
		const query = deferredSearch.trim().toLowerCase()
		if (!query) {
			return vehicles
		}

		return vehicles.filter((vehicle) => {
			return [
				vehicle.label,
				vehicle.licensePlate,
				vehicle.activeRental?.customerName ?? "",
				vehicle.device?.displayName ?? "",
				vehicle.device?.externalDeviceId ?? "",
			]
				.join(" ")
				.toLowerCase()
				.includes(query)
		})
	}, [deferredSearch, vehicles])

	const defaultViewport = useMemo(
		() => liveQuery.data?.defaultViewport ?? getFleetViewportDefaults(),
		[liveQuery.data?.defaultViewport],
	)

	const selectVehicle = (vehicleId: string) => {
		const params = new URLSearchParams(searchParams.toString())
		params.set("vehicle", vehicleId)
		startTransition(() => {
			router.replace(`${pathname}?${params.toString()}`, { scroll: false })
		})
		setIsRailOpen(false)
	}

	const headerContent = (
		<div className="min-w-0">
			<div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
				<Signal className="size-3.5 text-primary" />
				Live telemetry
			</div>
			<p className="mt-1 truncate text-sm font-semibold">
				{selectedVehicle?.label ?? "Melbourne fleet overview"}
			</p>
			<p className="truncate text-xs text-muted-foreground">
				{selectedVehicle?.snapshot
					? `${selectedVehicle.licensePlate} • ${formatLastSeen(
							selectedVehicle.snapshot.recordedAt,
						)}`
					: "Default viewport centered on Melbourne"}
			</p>
		</div>
	)

	return (
		<section className="flex w-full h-full ">
			<div className="flex min-h-0 flex-1 overflow-hidden">
				<div className="relative min-h-128 min-w-0 flex-1 border-r border-border/70">
					<FleetMapScene
						vehicles={vehicles}
						selectedVehicleId={selectedVehicleId}
						onSelectVehicle={selectVehicle}
						defaultViewport={defaultViewport}
						header={headerContent}
						className="h-full"
					/>
					<div className="absolute right-4 bottom-4 z-20 md:hidden">
						<Button
							type="button"
							className="rounded-full"
							onClick={() => setIsRailOpen(true)}
						>
							<Menu />
							Vehicles
						</Button>
					</div>
				</div>

				<div className="hidden h-full w-[380px] shrink-0 md:block xl:w-[420px]">
					<FleetRail
						vehicles={filteredVehicles}
						selectedVehicleId={selectedVehicleId}
						onSelectVehicle={selectVehicle}
						search={search}
						onSearchChange={setSearch}
					/>
				</div>
			</div>

			<Sheet open={isRailOpen} onOpenChange={setIsRailOpen}>
				<SheetContent side="right" className="w-[92vw] max-w-none p-0">
					<SheetHeader className="border-b border-border/70">
						<SheetTitle>Fleet live</SheetTitle>
						<SheetDescription>
							Select a vehicle to focus the live map.
						</SheetDescription>
					</SheetHeader>
					<div className="min-h-0 flex-1">
						<FleetRail
							vehicles={filteredVehicles}
							selectedVehicleId={selectedVehicleId}
							onSelectVehicle={selectVehicle}
							search={search}
							onSearchChange={setSearch}
						/>
					</div>
				</SheetContent>
			</Sheet>
		</section>
	)
}
