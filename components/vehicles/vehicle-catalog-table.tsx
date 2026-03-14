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
	Columns3,
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
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
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
	const [columnVisibility, setColumnVisibility] = useState<
		Record<string, boolean>
	>({})

	const fuelTypeOptions = useMemo(() => {
		return [...new Set(vehicles.map((vehicle) => vehicle.fuelType))].sort()
	}, [vehicles])

	const statusOptions = useMemo(() => {
		return [...new Set(vehicles.map((vehicle) => vehicle.status))].sort()
	}, [vehicles])

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
			columnVisibility,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		onColumnVisibilityChange: setColumnVisibility,
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

	return (
		<section className="space-y-4 rounded-xl border">
			<header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
				<div>
					<p className="text-sm font-medium">Fleet list</p>
					<p className="text-muted-foreground text-xs">
						Search, filter, and sort your vehicles.
					</p>
				</div>
				<Badge variant="outline">{vehicles.length} vehicles</Badge>
			</header>

			<div className="space-y-3 px-4 pt-1">
				<div className="grid gap-2 lg:grid-cols-[1fr_180px_180px_auto_auto]">
					<div className="relative">
						<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
						<Input
							value={globalFilter}
							onChange={(event) => setGlobalFilter(event.target.value)}
							placeholder="Search by vehicle, plate, fuel, status"
							className="h-10 pl-9"
						/>
					</div>

					<Select
						value={String(table.getColumn("status")?.getFilterValue() ?? "all")}
						onValueChange={(value) => {
							table
								.getColumn("status")
								?.setFilterValue(value === "all" ? undefined : value)
						}}
					>
						<SelectTrigger className="h-10 w-full">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All status</SelectItem>
							{statusOptions.map((status) => (
								<SelectItem key={status} value={status}>
									{status}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={String(
							table.getColumn("fuelType")?.getFilterValue() ?? "all",
						)}
						onValueChange={(value) => {
							table
								.getColumn("fuelType")
								?.setFilterValue(value === "all" ? undefined : value)
						}}
					>
						<SelectTrigger className="h-10 w-full">
							<SelectValue placeholder="Fuel" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All fuel</SelectItem>
							{fuelTypeOptions.map((fuelType) => (
								<SelectItem key={fuelType} value={fuelType}>
									{fuelType}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="outline" className="h-10">
								<Columns3 />
								Columns
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-44">
							<DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{table
								.getAllColumns()
								.filter((column) => column.getCanHide())
								.map((column) => (
									<DropdownMenuCheckboxItem
										key={column.id}
										checked={column.getIsVisible()}
										onCheckedChange={(isChecked) =>
											column.toggleVisibility(Boolean(isChecked))
										}
									>
										{column.id === "createdAt" ? "Created" : column.id}
									</DropdownMenuCheckboxItem>
								))}
						</DropdownMenuContent>
					</DropdownMenu>

					<Button
						type="button"
						variant="outline"
						className="h-10"
						onClick={() => {
							setGlobalFilter("")
							table.resetColumnFilters()
							setSorting([])
						}}
					>
						Reset
					</Button>
				</div>
			</div>

			<div className="px-4 pb-2">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
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
									className="text-muted-foreground h-24 text-center"
								>
									No vehicles match your current filters.
								</TableCell>
							</TableRow>
						) : (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									onClick={() => onOpenVehicle(row.original.id)}
									className="cursor-pointer"
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

			<footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
				<div className="text-muted-foreground text-xs">
					Showing {pageStart}-{pageEnd} of {totalFilteredRows} vehicles
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Select
						value={String(pageSize)}
						onValueChange={(value) => table.setPageSize(Number(value))}
					>
						<SelectTrigger className="h-9 w-28">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{pageSizeOptions.map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size} / page
								</SelectItem>
							))}
						</SelectContent>
					</Select>

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
