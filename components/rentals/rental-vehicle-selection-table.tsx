"use client"

import { Check, ChevronDown, Search, ShieldCheck, Sparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { MediaImage } from "@/components/media/media-image"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import {
	AppWheelPicker,
	type WheelPickerOption,
} from "@/components/ui/wheel-picker"
import type { VehicleSummary } from "@/features/vehicles"

type RentalVehicleSelectionTableProps = {
	vehicles: VehicleSummary[]
	selectedVehicleId: string | null
	onSelectVehicle: (vehicleId: string) => void
}

type VehicleSortValue =
	| "vehicle_asc"
	| "vehicle_desc"
	| "rate_asc"
	| "rate_desc"
	| "year_desc"

type DrawerOption = {
	value: string
	label: string
}

const statusOptions: DrawerOption[] = [
	{ value: "Available", label: "Available only" },
	{ value: "Rented", label: "Rented" },
	{ value: "Maintenance", label: "Maintenance" },
	{ value: "Retired", label: "Retired" },
	{ value: "all", label: "All status" },
]

const sortOptions: DrawerOption[] = [
	{ value: "vehicle_asc", label: "Vehicle A-Z" },
	{ value: "vehicle_desc", label: "Vehicle Z-A" },
	{ value: "year_desc", label: "Newest year" },
	{ value: "rate_asc", label: "Lowest rate" },
	{ value: "rate_desc", label: "Highest rate" },
]

function initialsFromVehicle(vehicle: VehicleSummary) {
	const brandInitial = vehicle.brandName.trim().charAt(0).toUpperCase()
	const modelInitial = vehicle.modelName.trim().charAt(0).toUpperCase()

	return `${brandInitial}${modelInitial}`
}

function formatVehicleRate(vehicle: VehicleSummary) {
	if (!vehicle.primaryRate) {
		return "Rate unavailable"
	}

	const period =
		vehicle.primaryRate.pricingModel === "Daily"
			? "/ day"
			: vehicle.primaryRate.pricingModel === "Weekly"
				? "/ week"
				: vehicle.primaryRate.pricingModel === "Monthly"
					? "/ month"
					: ""

	return `${new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
		maximumFractionDigits: 0,
	}).format(vehicle.primaryRate.rate)} ${period}`.trim()
}

function sortVehicles(vehicles: VehicleSummary[], sortValue: VehicleSortValue) {
	const collator = new Intl.Collator("en", {
		numeric: true,
		sensitivity: "base",
	})

	return [...vehicles].sort((left, right) => {
		const leftLabel = `${left.year} ${left.brandName} ${left.modelName}`
		const rightLabel = `${right.year} ${right.brandName} ${right.modelName}`
		const leftRate = left.primaryRate?.rate ?? Number.POSITIVE_INFINITY
		const rightRate = right.primaryRate?.rate ?? Number.POSITIVE_INFINITY

		switch (sortValue) {
			case "vehicle_desc":
				return collator.compare(rightLabel, leftLabel)
			case "rate_asc":
				return leftRate - rightRate
			case "rate_desc":
				return rightRate - leftRate
			case "year_desc":
				return right.year - left.year
			default:
				return collator.compare(leftLabel, rightLabel)
		}
	})
}

function WheelSelectField({
	value,
	options,
	title,
	description,
	placeholder,
	onValueChange,
}: {
	value: string
	options: DrawerOption[]
	title: string
	description: string
	placeholder: string
	onValueChange: (value: string) => void
}) {
	const [open, setOpen] = useState(false)
	const wheelOptions = options as WheelPickerOption<string>[]
	const resolvedValue =
		options.find((option) => option.value === value)?.value ??
		options[0]?.value ??
		""
	const selectedOption = options.find(
		(option) => option.value === resolvedValue,
	)
	const [pendingValue, setPendingValue] = useState(resolvedValue)

	useEffect(() => {
		if (!open) {
			setPendingValue(resolvedValue)
		}
	}, [open, resolvedValue])

	return (
		<>
			<InputGroup className="h-12">
				<InputGroupInput
					readOnly
					value={selectedOption?.label ?? ""}
					placeholder={placeholder}
					onClick={() => {
						setOpen(true)
					}}
					className="h-full cursor-pointer"
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						size="icon-sm"
						onClick={() => {
							setOpen(true)
						}}
					>
						<ChevronDown className="size-4" />
						<span className="sr-only">Open selector</span>
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			<ResponsiveDrawer
				open={open}
				onOpenChange={setOpen}
				title={title}
				description={description}
				desktopClassName="max-h-[88vh] overflow-hidden p-0 sm:max-w-xl"
				mobileClassName="max-h-[88vh] rounded-t-3xl p-0"
			>
				<div className="space-y-4 px-4 pb-4 md:px-5">
					<AppWheelPicker
						value={pendingValue}
						onValueChange={setPendingValue}
						options={wheelOptions}
						visibleCount={14}
						optionItemHeight={42}
						className="rounded-3xl p-4"
					/>
					<button
						type="button"
						className="bg-primary text-primary-foreground h-12 w-full rounded-2xl px-4 text-sm font-medium"
						onClick={() => {
							onValueChange(pendingValue)
							setOpen(false)
						}}
					>
						Confirm
					</button>
				</div>
			</ResponsiveDrawer>
		</>
	)
}

export function RentalVehicleSelectionTable({
	vehicles,
	selectedVehicleId,
	onSelectVehicle,
}: RentalVehicleSelectionTableProps) {
	const [searchValue, setSearchValue] = useState("")
	const [statusFilter, setStatusFilter] = useState<string>("Available")
	const [sortValue, setSortValue] = useState<VehicleSortValue>("vehicle_asc")

	const visibleVehicles = useMemo(() => {
		const search = searchValue.trim().toLowerCase()
		const filtered = vehicles.filter((vehicle) => {
			if (statusFilter !== "all" && vehicle.status !== statusFilter) {
				return false
			}

			if (!search) {
				return true
			}

			const haystack = [
				vehicle.year,
				vehicle.brandName,
				vehicle.modelName,
				vehicle.licensePlate,
				vehicle.status,
			]
				.join(" ")
				.toLowerCase()

			return haystack.includes(search)
		})

		return sortVehicles(filtered, sortValue)
	}, [searchValue, sortValue, statusFilter, vehicles])

	return (
		<div className="space-y-5">
			<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
				<InputGroup className="h-12">
					<InputGroupAddon align="inline-start">
						<InputGroupText>
							<Search className="size-4" />
						</InputGroupText>
					</InputGroupAddon>
					<InputGroupInput
						value={searchValue}
						onChange={(event) => setSearchValue(event.target.value)}
						placeholder="Search by vehicle, model, or plate"
						className="h-full"
					/>
				</InputGroup>

				<WheelSelectField
					value={statusFilter}
					options={statusOptions}
					title="Filter vehicles"
					description="Choose which vehicle status to show in the rental picker."
					placeholder="Filter status"
					onValueChange={setStatusFilter}
				/>

				<WheelSelectField
					value={sortValue}
					options={sortOptions}
					title="Sort vehicles"
					description="Choose the ordering for the rental vehicle cards."
					placeholder="Sort vehicles"
					onValueChange={(value) => setSortValue(value as VehicleSortValue)}
				/>
			</div>

			{visibleVehicles.length === 0 ? (
				<div className="rounded-[28px] border border-dashed px-4 py-12 text-center">
					<p className="font-medium">
						No vehicles matched your current filters.
					</p>
					<p className="text-muted-foreground mt-2 text-sm">
						Try another search term or switch the status filter.
					</p>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
					{visibleVehicles.map((vehicle) => {
						const isSelected = selectedVehicleId === vehicle.id
						const canSelect = vehicle.status === "Available"

						return (
							<button
								key={vehicle.id}
								type="button"
								onClick={() => {
									if (canSelect) {
										onSelectVehicle(vehicle.id)
									}
								}}
								disabled={!canSelect}
								aria-pressed={isSelected}
								className={`group overflow-hidden rounded-[30px] border bg-background text-left transition ${
									isSelected
										? "border-primary ring-primary/15 ring-4"
										: canSelect
											? "hover:border-primary/35 hover:-translate-y-0.5 hover:shadow-lg"
											: "cursor-not-allowed opacity-60"
								}`}
							>
								<div className="relative aspect-[4/3] overflow-hidden bg-muted">
									{vehicle.frontImage ? (
										<MediaImage
											asset={{
												id: vehicle.frontImage.assetId,
												deliveryUrl: vehicle.frontImage.deliveryUrl,
												visibility: "private",
												blurDataUrl: vehicle.frontImage.blurDataUrl,
												originalFileName: `${vehicle.brandName}-${vehicle.modelName}`,
												contentType: "image/jpeg",
											}}
											alt={`${vehicle.brandName} ${vehicle.modelName}`}
											fill
											sizes="(max-width: 1024px) 100vw, 33vw"
											className="object-cover transition duration-300 group-hover:scale-[1.03]"
										/>
									) : (
										<div className="flex size-full items-center justify-center bg-muted text-4xl font-semibold text-muted-foreground">
											{initialsFromVehicle(vehicle)}
										</div>
									)}

									<div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
										<span
											className={`rounded-full px-3 py-1 text-xs font-medium backdrop-blur ${
												vehicle.status === "Available"
													? "bg-emerald-500/90 text-white"
													: "bg-background/90 text-foreground"
											}`}
										>
											{vehicle.status}
										</span>
										{isSelected ? (
											<span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium">
												<Check className="size-3.5" />
												Selected
											</span>
										) : null}
									</div>
								</div>

								<div className="space-y-4 p-5">
									<div className="space-y-1">
										<p className="text-lg font-semibold">
											{vehicle.year} {vehicle.brandName} {vehicle.modelName}
										</p>
										<p className="text-muted-foreground text-sm">
											Plate {vehicle.licensePlate}
										</p>
									</div>

									<div className="flex items-end justify-between gap-4">
										<div>
											<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
												Primary rate
											</p>
											<p className="mt-1 text-base font-semibold">
												{formatVehicleRate(vehicle)}
											</p>
										</div>
										<span
											className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium ${
												canSelect
													? "bg-primary/8 text-primary"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{isSelected
												? "Ready"
												: canSelect
													? "Tap to choose"
													: "Unavailable"}
										</span>
									</div>

									<div className="flex flex-wrap gap-2">
										{vehicle.primaryRate?.requiresDeposit ? (
											<span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
												<ShieldCheck className="size-3.5" />
												Deposit required
											</span>
										) : (
											<span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-900">
												<Sparkles className="size-3.5" />
												Quick checkout
											</span>
										)}
									</div>
								</div>
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}
