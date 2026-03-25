"use client"

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table"
import { MoreHorizontal, ShieldBan, ShieldCheck, Trash2 } from "lucide-react"
import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import type { CustomerListRow } from "@/features/customers/types"

type CustomerTableProps = {
	rows: CustomerListRow[]
	isLoading: boolean
	errorMessage: string | null
	page: number
	pageCount: number
	total: number
	canManageCustomers: boolean
	onPageChange: (page: number) => void
	onRowClick: (customerId: string) => void
	onToggleBan: (customer: CustomerListRow) => void
	onDelete: (customer: CustomerListRow) => void
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

function formatVerificationStatus(status: string) {
	if (status === "in_review") {
		return "In review"
	}

	return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDate(value: string) {
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return "-"
	}

	return parsed.toLocaleDateString("en-AU", {
		dateStyle: "medium",
	})
}

export function CustomerTable({
	rows,
	isLoading,
	errorMessage,
	page,
	pageCount,
	total,
	canManageCustomers,
	onPageChange,
	onRowClick,
	onToggleBan,
	onDelete,
}: CustomerTableProps) {
	const columns = useMemo<Array<ColumnDef<CustomerListRow>>>(
		() => [
			{
				id: "customer",
				header: "Customer",
				cell: ({ row }) => (
					<div className="space-y-1">
						<p className="font-medium">{row.original.fullName}</p>
						<p className="text-muted-foreground text-xs">
							ID {row.original.id.slice(0, 8)}
						</p>
					</div>
				),
			},
			{
				id: "contact",
				header: "Contact",
				cell: ({ row }) => (
					<div className="space-y-1">
						<p className="text-sm">{row.original.email ?? "No email"}</p>
						<p className="text-muted-foreground text-xs">
							{row.original.phone ?? "No phone"}
						</p>
					</div>
				),
			},
			{
				accessorKey: "branchName",
				header: "Branch",
				cell: ({ row }) => (
					<span className="text-sm">
						{row.original.branchName ?? "Unassigned"}
					</span>
				),
			},
			{
				id: "verification",
				header: "Verification",
				cell: ({ row }) => (
					<Badge variant="outline">
						{formatVerificationStatus(row.original.verificationStatus)}
					</Badge>
				),
			},
			{
				id: "status",
				header: "Status",
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.status === "banned" ? "destructive" : "secondary"
						}
					>
						{row.original.status === "banned" ? "Banned" : "Active"}
					</Badge>
				),
			},
			{
				accessorKey: "createdAt",
				header: "Created",
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{formatDate(row.original.createdAt)}
					</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<div className="flex justify-end">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onClick={(event) => event.stopPropagation()}
									disabled={!canManageCustomers}
								>
									<MoreHorizontal className="size-4" />
									<span className="sr-only">Customer actions</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={(event) => {
										event.stopPropagation()
										onToggleBan(row.original)
									}}
								>
									{row.original.status === "banned" ? (
										<ShieldCheck className="size-4" />
									) : (
										<ShieldBan className="size-4" />
									)}
									{row.original.status === "banned"
										? "Unban customer"
										: "Ban customer"}
								</DropdownMenuItem>
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onClick={(event) => {
										event.stopPropagation()
										onDelete(row.original)
									}}
								>
									<Trash2 className="size-4" />
									Delete customer
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			},
		],
		[canManageCustomers, onDelete, onToggleBan],
	)

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	})

	const paginationItems = buildPaginationItems(page - 1, pageCount)

	return (
		<div className="space-y-4">
			<div className="overflow-hidden rounded-2xl border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow
								key={headerGroup.id}
								className="bg-muted/30 hover:bg-muted/30"
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
						{isLoading ? (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-32 text-center"
								>
									<span className="text-muted-foreground text-sm">
										Loading customers...
									</span>
								</TableCell>
							</TableRow>
						) : errorMessage ? (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-32 text-center"
								>
									<span className="text-destructive text-sm">
										{errorMessage}
									</span>
								</TableCell>
							</TableRow>
						) : rows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-32 text-center"
								>
									<div className="space-y-1">
										<p className="font-medium">No customers found</p>
										<p className="text-muted-foreground text-sm">
											Adjust your filters or create a new customer.
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									className="cursor-pointer transition-colors hover:bg-muted/20"
									onClick={() => onRowClick(row.original.id)}
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

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-muted-foreground text-sm">
					{total === 0
						? "No customers"
						: `Page ${page} of ${pageCount} • ${total} customer${total === 1 ? "" : "s"}`}
				</p>
				<Pagination className="justify-start sm:justify-end">
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious
								href="#"
								onClick={(event) => {
									event.preventDefault()
									if (page > 1) {
										onPageChange(page - 1)
									}
								}}
								aria-disabled={page <= 1}
								className={
									page <= 1 ? "pointer-events-none opacity-50" : undefined
								}
							/>
						</PaginationItem>
						{paginationItems.map((item, index) => (
							<PaginationItem
								key={
									item === "ellipsis"
										? `ellipsis-${paginationItems[index - 1] ?? index}`
										: item
								}
							>
								{item === "ellipsis" ? (
									<PaginationEllipsis />
								) : (
									<PaginationLink
										href="#"
										isActive={item + 1 === page}
										onClick={(event) => {
											event.preventDefault()
											onPageChange(item + 1)
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
									if (page < pageCount) {
										onPageChange(page + 1)
									}
								}}
								aria-disabled={page >= pageCount}
								className={
									page >= pageCount
										? "pointer-events-none opacity-50"
										: undefined
								}
							/>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			</div>
		</div>
	)
}
