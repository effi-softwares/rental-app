"use client"

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import {
	ArrowUpDown,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	HandCoins,
	MoreVertical,
	Search,
	Trash2,
	Wrench,
} from "lucide-react"
import { useMemo, useState } from "react"

import { MediaImage } from "@/components/media/media-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import {
	WheelSelectField,
	type WheelSelectOption,
} from "@/components/ui/wheel-select-field"
import type { VehicleStatus, VehicleSummary } from "@/features/vehicles"

type VehicleCatalogTableProps = {
	vehicles: VehicleSummary[]
	canManageVehicles: boolean
	canCreateRentals: boolean
	onOpenVehicle: (vehicleId: string) => void
	onToggleMaintenance: (vehicle: VehicleSummary) => void
	onDeleteVehicle: (vehicle: VehicleSummary) => void
	onRentVehicle: (vehicle: VehicleSummary) => void
}

const pageSizeOptions = [5, 10, 20, 50]

function statusBadgeVariant(
	status: VehicleStatus,
): "secondary" | "destructive" | "outline" {
	if (status === "Retired") {
		return "destructive"
	}

	if (status === "Maintenance") {
		return "outline"
	}

	return "secondary"
}

function formatDateLabel(value: string) {
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return "-"
	}

	return parsed.toLocaleDateString()
}

function initialsFromVehicle(vehicle: VehicleSummary) {
	const brandInitial = vehicle.brandName.trim().charAt(0).toUpperCase()
	const modelInitial = vehicle.modelName.trim().charAt(0).toUpperCase()

	return `${brandInitial}${modelInitial}`
}

function SortableHeader({
	label,
	isSorted,
	onClick,
}: {
	label: string
	isSorted: false | "asc" | "desc"
	onClick: () => void
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="-ml-2 h-8 px-2"
			onClick={onClick}
		>
			{label}
			{isSorted === "asc" ? (
				<ChevronUp className="size-4" />
			) : isSorted === "desc" ? (
				<ChevronDown className="size-4" />
			) : (
				<ArrowUpDown className="size-4" />
			)}
		</Button>
	)
}

export function VehicleCatalogTable({
	vehicles,
	canManageVehicles,
	canCreateRentals,
	onOpenVehicle,
	onToggleMaintenance,
	onDeleteVehicle,
	onRentVehicle,
}: VehicleCatalogTableProps) {
	const [sorting, setSorting] = useState<SortingState>([])
	const [columnFilters, setColumnFilters] = useState<
		Array<{ id: string; value: unknown }>
	>([])
	const [globalFilter, setGlobalFilter] = useState("")

	const fuelFilterOptions = useMemo<WheelSelectOption[]>(() => {
		return [
			{ value: "all", label: "All fuel" },
			...[...new Set(vehicles.map((vehicle) => vehicle.fuelType))]
				.sort()
				.map((fuelType) => ({
					value: fuelType,
					label: fuelType,
				})),
		]
	}, [vehicles])

	const statusFilterOptions = useMemo<WheelSelectOption[]>(() => {
		return [
			{ value: "all", label: "All status" },
			...[...new Set(vehicles.map((vehicle) => vehicle.status))]
				.sort()
				.map((status) => ({
					value: status,
					label: status,
				})),
		]
	}, [vehicles])

	const pageSizeFilterOptions = useMemo<WheelSelectOption[]>(
		() =>
			pageSizeOptions.map((size) => ({
				value: String(size),
				label: `${size} per page`,
			})),
		[],
	)

	const columns = useMemo<Array<ColumnDef<VehicleSummary>>>(
		() => [
			{
				id: "vehicle",
				accessorFn: (vehicle) =>
					`${vehicle.year} ${vehicle.brandName} ${vehicle.modelName}`,
				header: ({ column }) => (
					<SortableHeader
						label="Vehicle"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
				cell: ({ row }) => {
					const vehicle = row.original

					return (
						<div className="flex items-center gap-3">
							<div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-full border">
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
										sizes="40px"
										className="object-cover"
									/>
								) : (
									<div className="text-muted-foreground flex size-full items-center justify-center text-xs font-medium">
										{initialsFromVehicle(vehicle)}
									</div>
								)}
							</div>
							<div className="min-w-0 space-y-0.5">
								<p className="truncate font-medium">
									{vehicle.year} {vehicle.brandName} {vehicle.modelName}
								</p>
								<p className="text-muted-foreground truncate text-xs">
									{vehicle.transmission} • {vehicle.fuelType}
								</p>
							</div>
						</div>
					)
				},
				enableHiding: false,
			},
			{
				accessorKey: "licensePlate",
				header: ({ column }) => (
					<SortableHeader
						label="Plate"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
				cell: ({ row }) => (
					<span className="font-medium tracking-wide uppercase">
						{row.original.licensePlate}
					</span>
				),
			},
			{
				accessorKey: "fuelType",
				header: ({ column }) => (
					<SortableHeader
						label="Fuel"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<SortableHeader
						label="Status"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
				cell: ({ row }) => (
					<Badge variant={statusBadgeVariant(row.original.status)}>
						{row.original.status}
					</Badge>
				),
			},
			{
				accessorKey: "createdAt",
				header: ({ column }) => (
					<SortableHeader
						label="Created"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground text-xs">
						{formatDateLabel(row.original.createdAt)}
					</span>
				),
			},
			{
				id: "actions",
				header: () => <span className="sr-only">Actions</span>,
				cell: ({ row }) => {
					const vehicle = row.original

					return (
						<div className="flex justify-end">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={(event) => event.stopPropagation()}
									>
										<MoreVertical />
										<span className="sr-only">Open actions</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-48">
									<DropdownMenuLabel>Vehicle actions</DropdownMenuLabel>
									<DropdownMenuItem onSelect={() => onOpenVehicle(vehicle.id)}>
										<CheckCircle2 />
										View details
									</DropdownMenuItem>
									{vehicle.status === "Available" && canCreateRentals ? (
										<DropdownMenuItem onSelect={() => onRentVehicle(vehicle)}>
											<HandCoins />
											Rent this vehicle
										</DropdownMenuItem>
									) : null}
									{canManageVehicles ? (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onSelect={() => onToggleMaintenance(vehicle)}
											>
												<Wrench />
												{vehicle.status === "Maintenance"
													? "Mark available"
													: "Mark maintenance"}
											</DropdownMenuItem>
											<DropdownMenuItem
												variant="destructive"
												onSelect={() => onDeleteVehicle(vehicle)}
											>
												<Trash2 />
												Delete vehicle
											</DropdownMenuItem>
										</>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)
				},
				enableSorting: false,
				enableHiding: false,
			},
		],
		[
			canCreateRentals,
			canManageVehicles,
			onDeleteVehicle,
			onOpenVehicle,
			onRentVehicle,
			onToggleMaintenance,
		],
	)

	const table = useReactTable({
		data: vehicles,
		columns,
		state: {
			sorting,
			columnFilters,
			globalFilter,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		globalFilterFn: (row, _columnId, value) => {
			const searchValue = String(value ?? "")
				.trim()
				.toLowerCase()
			if (!searchValue) {
				return true
			}

			const record = row.original
			const haystack = [
				record.year,
				record.brandName,
				record.modelName,
				record.licensePlate,
				record.fuelType,
				record.transmission,
				record.status,
			]
				.join(" ")
				.toLowerCase()

			return haystack.includes(searchValue)
		},
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: {
			pagination: {
				pageIndex: 0,
				pageSize: 10,
			},
		},
	})

	const totalFilteredRows = table.getFilteredRowModel().rows.length
	const { pageIndex, pageSize } = table.getState().pagination
	const pageStart = totalFilteredRows === 0 ? 0 : pageIndex * pageSize + 1
	const pageEnd = Math.min((pageIndex + 1) * pageSize, totalFilteredRows)
	const statusFilterValue = String(
		table.getColumn("status")?.getFilterValue() ?? "all",
	)
	const fuelFilterValue = String(
		table.getColumn("fuelType")?.getFilterValue() ?? "all",
	)
	const hasActiveFilters = Boolean(
		globalFilter.trim() ||
			statusFilterValue !== "all" ||
			fuelFilterValue !== "all" ||
			pageSize !== 10,
	)

	return (
		<section className="space-y-4">
			<div className="grid gap-3 rounded-2xl p-3 lg:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))_auto]">
				<div className="relative">
					<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
					<Input
						value={globalFilter}
						onChange={(event) => setGlobalFilter(event.target.value)}
						placeholder="Search by vehicle, plate, fuel, status"
						className="h-11 pl-9"
					/>
				</div>

				<WheelSelectField
					value={statusFilterValue}
					options={statusFilterOptions}
					placeholder="All status"
					title="Filter vehicle status"
					description="Choose which vehicle status to show in the table."
					onValueChange={(value) => {
						table
							.getColumn("status")
							?.setFilterValue(value === "all" ? undefined : value)
						table.setPageIndex(0)
					}}
				/>

				<WheelSelectField
					value={fuelFilterValue}
					options={fuelFilterOptions}
					placeholder="All fuel"
					title="Filter fuel type"
					description="Choose which fuel type to show in the table."
					onValueChange={(value) => {
						table
							.getColumn("fuelType")
							?.setFilterValue(value === "all" ? undefined : value)
						table.setPageIndex(0)
					}}
				/>

				<WheelSelectField
					value={String(pageSize)}
					options={pageSizeFilterOptions}
					placeholder="Rows per page"
					title="Rows per page"
					description="Choose how many vehicle rows to load per page."
					onValueChange={(value) => {
						table.setPageSize(Number(value))
						table.setPageIndex(0)
					}}
				/>

				<Button
					type="button"
					variant="outline"
					className="h-11"
					disabled={!hasActiveFilters}
					onClick={() => {
						setGlobalFilter("")
						table.resetColumnFilters()
						setSorting([])
						table.setPageSize(10)
						table.setPageIndex(0)
					}}
				>
					Reset filters
				</Button>
			</div>

			<div className="overflow-hidden rounded-2xl border">
				<div className="overflow-x-auto px-4 pb-2 pt-1">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow
									key={headerGroup.id}
									className="bg-muted/20 hover:bg-muted/20"
								>
									{headerGroup.headers.map((header) => (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-28 text-center"
									>
										<div className="space-y-1">
											<p className="font-medium">No vehicles found</p>
											<p className="text-muted-foreground text-sm">
												Adjust your filters to see more vehicles.
											</p>
										</div>
									</TableCell>
								</TableRow>
							) : (
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										onClick={() => onOpenVehicle(row.original.id)}
										className="cursor-pointer transition-colors hover:bg-muted/20"
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			<footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="text-muted-foreground text-sm">
					{totalFilteredRows === 0
						? "No vehicles"
						: `Showing ${pageStart}-${pageEnd} of ${totalFilteredRows} vehicles`}
				</div>

				<div className="flex flex-wrap items-center gap-2 sm:justify-end">
					<div className="text-muted-foreground px-2 text-xs">
						Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
					</div>

					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Previous
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
					</Button>
				</div>
			</footer>
		</section>
	)
}
