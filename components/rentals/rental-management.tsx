"use client"

import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingFn,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import {
	ArrowUpDown,
	ChevronDown,
	ChevronUp,
	Ellipsis,
	Search,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
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
import { routes } from "@/config/routes"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { useRentalDraftQuery, useRentalsListQuery } from "@/features/rentals"
import {
	getRentalNextAction,
	getRentalNextActionLabel,
	getRentalNextStepCopy,
	getRentalPlanLabel,
	getRentalPriorityRank,
	getRentalStatusLabel,
	type RentalNextAction,
} from "@/features/rentals/lib/ui-state"
import type { RentalListItem } from "@/features/rentals/types/rental"
import { RentalAppointmentDrawer } from "./rental-appointment-drawer"
import { RentalHandoverDrawer } from "./rental-handover-drawer"
import { RentalReturnDrawer } from "./rental-return-drawer"

const pageSizeOptions = [10, 20, 50]

function rentalStatusBadgeClass(
	status:
		| "draft"
		| "awaiting_payment"
		| "scheduled"
		| "active"
		| "completed"
		| "cancelled",
) {
	switch (status) {
		case "active":
			return "border-emerald-200 bg-emerald-50 text-emerald-700"
		case "scheduled":
			return "border-sky-200 bg-sky-50 text-sky-700"
		case "awaiting_payment":
			return "border-amber-200 bg-amber-50 text-amber-700"
		case "completed":
			return "border-border bg-muted text-muted-foreground"
		case "cancelled":
			return "border-destructive/30 bg-destructive/10 text-destructive"
		case "draft":
			return "border-border bg-background text-muted-foreground"
	}
}

function formatDateTime(value: string | null) {
	if (!value) {
		return "Not scheduled"
	}

	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return "Not scheduled"
	}

	return parsed.toLocaleString("en-AU", {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

function getScheduleTimestamp(rental: RentalListItem) {
	const primary = rental.plannedStartAt ?? rental.createdAt
	const timestamp = new Date(primary).getTime()
	return Number.isNaN(timestamp) ? 0 : timestamp
}

const statusSort: SortingFn<RentalListItem> = (left, right) => {
	return (
		getRentalPriorityRank(left.original.status) -
		getRentalPriorityRank(right.original.status)
	)
}

const scheduleSort: SortingFn<RentalListItem> = (left, right) => {
	return (
		getScheduleTimestamp(left.original) - getScheduleTimestamp(right.original)
	)
}

function buildPaginationItems(pageIndex: number, pageCount: number) {
	if (pageCount <= 1) {
		return [0]
	}

	const pages = new Set<number>([
		0,
		pageCount - 1,
		pageIndex - 1,
		pageIndex,
		pageIndex + 1,
	])
	const normalizedPages = [...pages]
		.filter((value) => value >= 0 && value < pageCount)
		.sort((left, right) => left - right)

	const items: Array<number | "ellipsis"> = []

	for (const page of normalizedPages) {
		const previous = items[items.length - 1]
		if (typeof previous === "number" && page - previous > 1) {
			items.push("ellipsis")
		}
		items.push(page)
	}

	return items
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

function SummaryCard({
	label,
	value,
	subtitle,
}: {
	label: string
	value: string
	subtitle: string
}) {
	return (
		<div className="rounded-2xl border bg-background px-4 py-4 shadow-xs">
			<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
				{label}
			</p>
			<p className="mt-3 text-2xl font-semibold">{value}</p>
			<p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
		</div>
	)
}

function RentalIdentity({ rental }: { rental: RentalListItem }) {
	return (
		<div className="min-w-0">
			<Link
				href={routes.app.rentalDetails(rental.id)}
				className="group block rounded-lg p-1 -m-1 transition-colors hover:bg-muted/50"
			>
				<p className="truncate font-medium group-hover:underline">
					{rental.vehicle?.label ?? "Vehicle pending"}
				</p>
				<p className="text-muted-foreground truncate text-xs">
					{rental.vehicle?.licensePlate ?? "No plate assigned"} • Rental{" "}
					{rental.id.slice(0, 8)}
				</p>
				<p className="mt-2 text-xs font-medium text-foreground">
					Open rental details
				</p>
			</Link>
		</div>
	)
}

function RentalTransitionMenu({
	rental,
	onSelectAction,
	canManagePayments,
}: {
	rental: RentalListItem
	onSelectAction: (rental: RentalListItem, action: RentalNextAction) => void
	canManagePayments: boolean
}) {
	const nextAction = getRentalNextAction({ status: rental.status })
	const actionLabel = getRentalNextActionLabel(nextAction)
	const isDisabled =
		nextAction === "none" || (nextAction === "handover" && !canManagePayments)

	return (
		<div className="flex justify-end">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						disabled={isDisabled}
						onClick={(event) => event.stopPropagation()}
					>
						<Ellipsis />
						<span className="sr-only">Open actions</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuLabel>Next action</DropdownMenuLabel>
					{actionLabel ? (
						<DropdownMenuItem
							onSelect={(event) => {
								event.preventDefault()
								onSelectAction(rental, nextAction)
							}}
						>
							{actionLabel}
						</DropdownMenuItem>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}

type RentalManagementProps = {
	statusPreset?: string
}

export function RentalManagement({ statusPreset }: RentalManagementProps) {
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const canManagePayments = Boolean(
		authContextQuery.data?.permissions.managePaymentsModule,
	)

	const rentalsQuery = useRentalsListQuery(activeOrganizationId, statusPreset)
	const [handoverFlowRental, setHandoverFlowRental] =
		useState<RentalListItem | null>(null)
	const handoverFlowDetailQuery = useRentalDraftQuery(
		activeOrganizationId,
		handoverFlowRental?.id,
	)
	const [returnFlowRental, setReturnFlowRental] =
		useState<RentalListItem | null>(null)
	const returnFlowDetailQuery = useRentalDraftQuery(
		activeOrganizationId,
		returnFlowRental?.id,
	)

	const [sorting, setSorting] = useState<SortingState>([])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [globalFilter, setGlobalFilter] = useState("")
	const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)

	const rentals = rentalsQuery.data?.rentals ?? []

	const handleTransitionAction = useCallback(
		(rental: RentalListItem, action: RentalNextAction) => {
			if (action === "handover") {
				setHandoverFlowRental(rental)
				return
			}

			if (action === "return") {
				setReturnFlowRental(rental)
			}
		},
		[],
	)

	const sortedRentals = useMemo(() => {
		return [...rentals].sort((left, right) => {
			const priorityDifference =
				getRentalPriorityRank(left.status) - getRentalPriorityRank(right.status)
			if (priorityDifference !== 0) {
				return priorityDifference
			}

			return getScheduleTimestamp(left) - getScheduleTimestamp(right)
		})
	}, [rentals])

	const statusOptions = useMemo(() => {
		return [...new Set(sortedRentals.map((rental) => rental.status))]
	}, [sortedRentals])

	const planOptions = useMemo(() => {
		return [...new Set(sortedRentals.map((rental) => rental.paymentPlanKind))]
	}, [sortedRentals])

	const summary = useMemo(() => {
		const scheduled = sortedRentals.filter(
			(item) => item.status === "scheduled",
		).length
		const active = sortedRentals.filter(
			(item) => item.status === "active",
		).length
		const attention = sortedRentals.filter((item) => {
			const action = getRentalNextAction({ status: item.status })
			return action !== "none"
		}).length

		return {
			scheduled,
			active,
			attention,
		}
	}, [sortedRentals])

	const columns = useMemo<Array<ColumnDef<RentalListItem>>>(
		() => [
			{
				id: "rental",
				accessorFn: (rental) =>
					`${rental.vehicle?.label ?? ""} ${rental.vehicle?.licensePlate ?? ""} ${rental.id}`,
				header: ({ column }) => (
					<SortableHeader
						label="Rental"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
				cell: ({ row }) => <RentalIdentity rental={row.original} />,
				enableHiding: false,
			},
			{
				id: "customer",
				accessorFn: (rental) =>
					`${rental.customer?.fullName ?? ""} ${rental.customer?.email ?? ""} ${rental.customer?.phone ?? ""}`,
				header: ({ column }) => (
					<SortableHeader
						label="Customer"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
				cell: ({ row }) => (
					<div className="min-w-0">
						<p className="truncate font-medium">
							{row.original.customer?.fullName ?? "Customer pending"}
						</p>
						<p className="text-muted-foreground truncate text-xs">
							{row.original.customer?.email ??
								row.original.customer?.phone ??
								"-"}
						</p>
					</div>
				),
			},
			{
				id: "status",
				accessorKey: "status",
				sortingFn: statusSort,
				filterFn: (row, _columnId, value) => {
					if (!value || value === "all") {
						return true
					}

					return row.original.status === value
				},
				header: ({ column }) => (
					<SortableHeader
						label="Status"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
				cell: ({ row }) => (
					<Badge
						variant="outline"
						className={rentalStatusBadgeClass(row.original.status)}
					>
						{getRentalStatusLabel(row.original.status)}
					</Badge>
				),
			},
			{
				id: "plan",
				accessorKey: "paymentPlanKind",
				filterFn: (row, _columnId, value) => {
					if (!value || value === "all") {
						return true
					}

					return row.original.paymentPlanKind === value
				},
				header: ({ column }) => (
					<SortableHeader
						label="Plan"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
				cell: ({ row }) => (
					<Badge variant="outline">
						{getRentalPlanLabel(row.original.paymentPlanKind)}
					</Badge>
				),
			},
			{
				id: "schedule",
				accessorFn: (rental) => getScheduleTimestamp(rental),
				sortingFn: scheduleSort,
				header: ({ column }) => (
					<SortableHeader
						label="Schedule"
						isSorted={column.getIsSorted()}
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					/>
				),
				cell: ({ row }) => (
					<div className="min-w-0">
						<p className="text-sm">
							{formatDateTime(row.original.plannedStartAt)}
						</p>
						<p className="text-muted-foreground truncate text-xs">
							Ends {formatDateTime(row.original.plannedEndAt)}
						</p>
					</div>
				),
			},
			{
				id: "actions",
				header: () => <span className="sr-only">Actions</span>,
				cell: ({ row }) => (
					<RentalTransitionMenu
						rental={row.original}
						canManagePayments={canManagePayments}
						onSelectAction={handleTransitionAction}
					/>
				),
				enableSorting: false,
			},
		],
		[canManagePayments, handleTransitionAction],
	)

	const table = useReactTable({
		data: sortedRentals,
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

			const rental = row.original
			const haystack = [
				rental.id,
				rental.vehicle?.label,
				rental.vehicle?.licensePlate,
				rental.customer?.fullName,
				rental.customer?.email,
				rental.customer?.phone,
				getRentalStatusLabel(rental.status),
				getRentalPlanLabel(rental.paymentPlanKind),
			]
				.filter(Boolean)
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

	const filteredRows = table.getFilteredRowModel().rows
	const pageRows = table.getRowModel().rows
	const { pageIndex, pageSize } = table.getState().pagination
	const totalFilteredRows = filteredRows.length
	const pageCount = Math.max(table.getPageCount(), 1)
	const pageStart = totalFilteredRows === 0 ? 0 : pageIndex * pageSize + 1
	const pageEnd = Math.min((pageIndex + 1) * pageSize, totalFilteredRows)
	const paginationItems = buildPaginationItems(pageIndex, pageCount)

	return (
		<div className="space-y-5">
			<PageSectionHeader
				title="Rentals"
				description="Track each rental clearly, find what matters fast, and move the next step forward with confidence."
				actions={
					<Button className="h-10" onClick={() => setIsCreateDrawerOpen(true)}>
						New rental
					</Button>
				}
			/>

			<div className="grid gap-3 md:grid-cols-3">
				<SummaryCard
					label="Needs action"
					value={String(summary.attention)}
					subtitle="Scheduled and active rentals appear first so staff can act quickly."
				/>
				<SummaryCard
					label="Scheduled"
					value={String(summary.scheduled)}
					subtitle="These rentals are waiting for vehicle handover."
				/>
				<SummaryCard
					label="Active"
					value={String(summary.active)}
					subtitle="These rentals are already out and will move into return next."
				/>
			</div>

			<section className="rounded-3xl border bg-background shadow-xs">
				<header className="border-b px-4 py-4 sm:px-5">
					<div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<p className="text-base font-semibold">Rental list</p>
							<p className="text-muted-foreground text-sm">
								Search, sort, and filter rentals without losing the next action.
							</p>
						</div>
						<Badge variant="outline">{totalFilteredRows} results</Badge>
					</div>
				</header>

				<div className="space-y-3 border-b px-4 py-4 sm:px-5">
					<div className="grid gap-2 xl:grid-cols-[1fr_220px_180px_auto]">
						<div className="relative">
							<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
							<Input
								value={globalFilter}
								onChange={(event) => setGlobalFilter(event.target.value)}
								placeholder="Search by rental, vehicle, plate, customer, phone, or email"
								className="h-10 pl-9"
							/>
						</div>

						<Select
							value={String(
								table.getColumn("status")?.getFilterValue() ?? "all",
							)}
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
										{getRentalStatusLabel(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={String(table.getColumn("plan")?.getFilterValue() ?? "all")}
							onValueChange={(value) => {
								table
									.getColumn("plan")
									?.setFilterValue(value === "all" ? undefined : value)
							}}
						>
							<SelectTrigger className="h-10 w-full">
								<SelectValue placeholder="Plan" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All plans</SelectItem>
								{planOptions.map((plan) => (
									<SelectItem key={plan} value={plan}>
										{getRentalPlanLabel(plan)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Button
							type="button"
							variant="outline"
							className="h-10"
							onClick={() => {
								setGlobalFilter("")
								table.resetColumnFilters()
								setSorting([])
								table.setPageIndex(0)
							}}
						>
							Reset
						</Button>
					</div>
				</div>

				<div className="md:hidden">
					{rentalsQuery.isPending ? (
						<p className="text-muted-foreground px-4 py-8 text-sm sm:px-5">
							Loading rentals...
						</p>
					) : pageRows.length === 0 ? (
						<p className="text-muted-foreground px-4 py-8 text-sm sm:px-5">
							No rentals match your current search or filters.
						</p>
					) : (
						<div className="space-y-3 px-4 py-4 sm:px-5">
							{pageRows.map((row) => {
								const rental = row.original
								const nextAction = getRentalNextAction({
									status: rental.status,
								})

								return (
									<article
										key={rental.id}
										className="rounded-2xl border bg-muted/20 p-4"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<RentalIdentity rental={rental} />
											</div>
											<RentalTransitionMenu
												rental={rental}
												canManagePayments={canManagePayments}
												onSelectAction={handleTransitionAction}
											/>
										</div>

										<div className="mt-4 flex flex-wrap items-center gap-2">
											<Badge
												variant="outline"
												className={rentalStatusBadgeClass(rental.status)}
											>
												{getRentalStatusLabel(rental.status)}
											</Badge>
											<Badge variant="outline">
												{getRentalPlanLabel(rental.paymentPlanKind)}
											</Badge>
										</div>

										<div className="mt-4 grid gap-3 text-sm">
											<div>
												<p className="text-muted-foreground text-xs">
													Customer
												</p>
												<p className="mt-1 font-medium">
													{rental.customer?.fullName ?? "Customer pending"}
												</p>
											</div>
											<div>
												<p className="text-muted-foreground text-xs">
													Schedule
												</p>
												<p className="mt-1">
													{formatDateTime(rental.plannedStartAt)}
												</p>
												<p className="text-muted-foreground text-xs">
													Ends {formatDateTime(rental.plannedEndAt)}
												</p>
											</div>
											<div>
												<p className="text-muted-foreground text-xs">
													Next step
												</p>
												<p className="mt-1 font-medium">
													{getRentalNextStepCopy(nextAction)}
												</p>
											</div>
										</div>
									</article>
								)
							})}
						</div>
					)}
				</div>

				<div className="hidden md:block px-4 py-4 sm:px-5">
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
							{rentalsQuery.isPending ? (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center"
									>
										Loading rentals...
									</TableCell>
								</TableRow>
							) : pageRows.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center"
									>
										No rentals match your current search or filters.
									</TableCell>
								</TableRow>
							) : (
								pageRows.map((row) => (
									<TableRow key={row.id}>
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

				<footer className="flex flex-col gap-3 border-t px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
					<div className="text-muted-foreground text-sm">
						Showing {pageStart}-{pageEnd} of {totalFilteredRows} rentals
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<Select
							value={String(pageSize)}
							onValueChange={(value) => table.setPageSize(Number(value))}
						>
							<SelectTrigger className="h-9 w-full sm:w-28">
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

						<Pagination className="justify-start lg:justify-center">
							<PaginationContent>
								<PaginationItem>
									<PaginationPrevious
										href="#"
										onClick={(event) => {
											event.preventDefault()
											table.previousPage()
										}}
										className={
											!table.getCanPreviousPage()
												? "pointer-events-none opacity-50"
												: undefined
										}
									/>
								</PaginationItem>
								{paginationItems.map((item, index) => (
									<PaginationItem
										key={
											item === "ellipsis"
												? `ellipsis-after-${paginationItems[index - 1]}`
												: `page-${item}`
										}
									>
										{item === "ellipsis" ? (
											<PaginationEllipsis />
										) : (
											<PaginationLink
												href="#"
												isActive={item === pageIndex}
												onClick={(event) => {
													event.preventDefault()
													table.setPageIndex(item)
												}}
											>
												{item + 1}
											</PaginationLink>
										)}
									</PaginationItem>
								))}
								<PaginationItem>
									<PaginationNext
										href="#"
										onClick={(event) => {
											event.preventDefault()
											table.nextPage()
										}}
										className={
											!table.getCanNextPage()
												? "pointer-events-none opacity-50"
												: undefined
										}
									/>
								</PaginationItem>
							</PaginationContent>
						</Pagination>
					</div>
				</footer>
			</section>

			<RentalAppointmentDrawer
				open={isCreateDrawerOpen}
				onOpenChange={setIsCreateDrawerOpen}
				onRentalFinalized={() => {
					void rentalsQuery.refetch()
				}}
			/>

			{handoverFlowRental && handoverFlowDetailQuery.isPending ? (
				<ResponsiveDrawer
					open
					onOpenChange={(open) => {
						if (!open) {
							setHandoverFlowRental(null)
						}
					}}
					title="Loading handover flow"
					description="Fetching the rental details needed for the guided handover."
				>
					<p className="text-muted-foreground text-sm">
						Loading the handover workflow...
					</p>
				</ResponsiveDrawer>
			) : null}

			{handoverFlowRental && handoverFlowDetailQuery.data ? (
				<RentalHandoverDrawer
					open
					onOpenChange={(open) => {
						if (!open) {
							setHandoverFlowRental(null)
						}
					}}
					rentalId={handoverFlowRental.id}
					detail={handoverFlowDetailQuery.data}
					onUpdated={async () => {
						await handoverFlowDetailQuery.refetch()
						await rentalsQuery.refetch()
					}}
				/>
			) : null}

			{returnFlowRental && returnFlowDetailQuery.isPending ? (
				<ResponsiveDrawer
					open
					onOpenChange={(open) => {
						if (!open) {
							setReturnFlowRental(null)
						}
					}}
					title="Loading return flow"
					description="Fetching the rental details needed for the guided return."
				>
					<p className="text-muted-foreground text-sm">
						Loading the return workflow...
					</p>
				</ResponsiveDrawer>
			) : null}

			{returnFlowRental && returnFlowDetailQuery.data ? (
				<RentalReturnDrawer
					open
					onOpenChange={(open) => {
						if (!open) {
							setReturnFlowRental(null)
						}
					}}
					rentalId={returnFlowRental.id}
					detail={returnFlowDetailQuery.data}
					onUpdated={async () => {
						await returnFlowDetailQuery.refetch()
						await rentalsQuery.refetch()
					}}
				/>
			) : null}
		</div>
	)
}
