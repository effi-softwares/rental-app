"use client"

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table"
import { Copy, RefreshCw, Search, WalletCards } from "lucide-react"
import { startTransition, useDeferredValue, useMemo, useState } from "react"
import { toast } from "sonner"

import { PaymentDetailDrawer } from "@/components/payments/payment-detail-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group"
import { PageContentShell } from "@/components/ui/page-content-shell"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import {
	type PaymentLedgerPreset,
	type PaymentLedgerRow,
	type PaymentWebhookRow,
	usePaymentsLedgerQuery,
	usePaymentsSummaryQuery,
	usePaymentWebhooksQuery,
} from "@/features/payments"
import { resolveErrorMessage } from "@/lib/errors"
import { statusToneClassName } from "@/lib/theme-styles"

const presetOptions: Array<{
	value: PaymentLedgerPreset
	label: string
}> = [
	{ value: "all", label: "All" },
	{ value: "cash", label: "Cash" },
	{ value: "terminal_card", label: "Terminal card" },
	{ value: "direct_debit", label: "Direct debit" },
	{ value: "installments", label: "Installments" },
	{ value: "failures", label: "Failures" },
	{ value: "awaiting_settlement", label: "Awaiting settlement" },
]

type PaymentsView = "ledger" | "webhooks"

function formatCurrency(amount: number, currency: string) {
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency,
		maximumFractionDigits: 2,
	}).format(amount)
}

function formatDateTime(value: string | null) {
	if (!value) {
		return "-"
	}

	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return "-"
	}

	return parsed.toLocaleString("en-AU", {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

function paymentStatusBadgeClass(status: PaymentLedgerRow["status"]) {
	switch (status) {
		case "succeeded":
			return statusToneClassName("success")
		case "processing":
		case "pending":
			return statusToneClassName("info")
		case "requires_action":
			return statusToneClassName("warning")
		case "failed":
		case "cancelled":
		case "refunded":
			return statusToneClassName("danger")
		default:
			return statusToneClassName("neutral")
	}
}

function webhookStatusBadgeClass(status: PaymentWebhookRow["status"]) {
	switch (status) {
		case "processed":
			return statusToneClassName("success")
		case "failed":
			return statusToneClassName("danger")
		case "ignored":
			return statusToneClassName("muted")
		default:
			return statusToneClassName("info")
	}
}

async function copyValue(value: string, label: string) {
	try {
		await navigator.clipboard.writeText(value)
		toast.success(`${label} copied.`)
	} catch (error) {
		toast.error(resolveErrorMessage(error, `Failed to copy ${label}.`))
	}
}

function SummaryCard({
	title,
	value,
	subtitle,
}: {
	title: string
	value: string
	subtitle: string
}) {
	return (
		<Card size="sm">
			<CardHeader className="gap-2">
				<CardTitle className="text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1">
				<p className="text-2xl font-semibold">{value}</p>
				<p className="text-muted-foreground text-xs">{subtitle}</p>
			</CardContent>
		</Card>
	)
}

export function PaymentsLedger() {
	const authContextQuery = useAuthContextQuery()
	const organizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const [preset, setPreset] = useState<PaymentLedgerPreset>("all")
	const [search, setSearch] = useState("")
	const [page, setPage] = useState(1)
	const [pageSize] = useState(25)
	const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
		null,
	)
	const [activeView, setActiveView] = useState<PaymentsView>("ledger")
	const [webhookStatus, setWebhookStatus] = useState<"all" | "failed">("all")
	const deferredSearch = useDeferredValue(search.trim())

	const summaryQuery = usePaymentsSummaryQuery(organizationId)
	const ledgerQuery = usePaymentsLedgerQuery(organizationId, {
		preset,
		search: deferredSearch,
		page,
		pageSize,
	})
	const webhooksQuery = usePaymentWebhooksQuery(organizationId, webhookStatus)

	const columns = useMemo<Array<ColumnDef<PaymentLedgerRow>>>(
		() => [
			{
				id: "payment",
				header: "Payment",
				cell: ({ row }) => (
					<div className="space-y-1">
						<p className="font-medium">{row.original.id.slice(0, 8)}</p>
						<p className="text-muted-foreground text-xs">
							{row.original.kind.replaceAll("_", " ")}
						</p>
					</div>
				),
			},
			{
				id: "customer",
				header: "Customer",
				cell: ({ row }) => (
					<div className="space-y-1">
						<p className="font-medium">
							{row.original.customerName ?? "Unknown"}
						</p>
						<p className="text-muted-foreground text-xs">
							{row.original.customerEmail ?? row.original.rentalId}
						</p>
					</div>
				),
			},
			{
				id: "schedule",
				header: "Schedule",
				cell: ({ row }) => (
					<div className="space-y-1">
						<p className="font-medium">
							{row.original.scheduleLabel ?? "No linked schedule"}
						</p>
						<p className="text-muted-foreground text-xs">
							{formatDateTime(row.original.scheduleDueAt)}
						</p>
						{row.original.scheduleFailureReason ? (
							<p className="text-xs text-destructive">
								{row.original.scheduleFailureReason}
							</p>
						) : null}
					</div>
				),
			},
			{
				id: "status",
				header: "Status",
				cell: ({ row }) => (
					<div className="space-y-2">
						<Badge
							variant="outline"
							className={paymentStatusBadgeClass(row.original.status)}
						>
							{row.original.status.replaceAll("_", " ")}
						</Badge>
						<p className="text-muted-foreground text-xs">
							{row.original.paymentMethodType ?? "-"} /{" "}
							{row.original.collectionSurface ?? "-"}
						</p>
					</div>
				),
			},
			{
				id: "amount",
				header: "Amount",
				cell: ({ row }) => (
					<div className="space-y-1 text-right">
						<p className="font-medium">
							{formatCurrency(row.original.amount, row.original.currency)}
						</p>
						<p className="text-muted-foreground text-xs">
							{row.original.paymentPlanKind}
						</p>
					</div>
				),
			},
			{
				id: "refs",
				header: "Refs",
				cell: ({ row }) => (
					<div className="space-y-1">
						<p className="font-mono text-xs">
							{row.original.paymentIntentId ??
								row.original.setupIntentId ??
								row.original.invoiceId ??
								"-"}
						</p>
						<p className="text-muted-foreground text-xs">
							{row.original.branchName ?? "No branch"}
						</p>
					</div>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								setSelectedPaymentId(row.original.id)
							}}
						>
							Details
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								void copyValue(row.original.id, "Payment id")
							}}
						>
							<Copy />
						</Button>
					</div>
				),
			},
		],
		[],
	)

	const table = useReactTable({
		data: ledgerQuery.data?.rows ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	})

	const summary = summaryQuery.data?.summary
	const isRefreshing =
		summaryQuery.isFetching ||
		ledgerQuery.isFetching ||
		webhooksQuery.isFetching
	const activeViewDescription =
		activeView === "ledger"
			? "Business view of payment attempts, schedules, customers, and settlement status."
			: "Integration view of Stripe deliveries, processing outcomes, and webhook failures."

	return (
		<PageContentShell>
			<PageSectionHeader
				title="Payments"
				description="Review rental payments, installment settlement state, Stripe reconciliation history, and recent webhook deliveries from one ledger-focused page."
			/>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<SummaryCard
					title="Collected"
					value={formatCurrency(summary?.collectedAmount ?? 0, "AUD")}
					subtitle={`${summary?.collectedCount ?? 0} succeeded payments`}
				/>
				<SummaryCard
					title="Pending"
					value={String(summary?.pendingCount ?? 0)}
					subtitle="Pending or processing payment attempts"
				/>
				<SummaryCard
					title="Requires Action"
					value={String(summary?.requiresActionCount ?? 0)}
					subtitle="Customer or operator follow-up required"
				/>
				<SummaryCard
					title="Failures"
					value={String(summary?.failedCount ?? 0)}
					subtitle={`${summary?.failedWebhookCount ?? 0} failed webhooks`}
				/>
				<SummaryCard
					title="Pending BECS"
					value={String(summary?.pendingDirectDebitCount ?? 0)}
					subtitle="AU BECS charges or mandates awaiting settlement"
				/>
				<SummaryCard
					title="Past Due"
					value={String(summary?.recurringPastDueCount ?? 0)}
					subtitle="Recurring rental contracts marked past due"
				/>
			</div>

			<section className="rounded-xl border">
				<Tabs
					value={activeView}
					onValueChange={(value) => {
						setActiveView(value as PaymentsView)
					}}
					className="space-y-0"
				>
					<div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4">
						<div className="space-y-3">
							<div>
								<p className="font-medium">Payments operations</p>
								<p className="text-muted-foreground text-sm">
									{activeViewDescription}
								</p>
							</div>
							<TabsList className="h-auto w-full flex-wrap justify-start">
								<TabsTrigger value="ledger" className="flex-none">
									Payments ledger
								</TabsTrigger>
								<TabsTrigger value="webhooks" className="flex-none">
									Webhook reporting
								</TabsTrigger>
							</TabsList>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								void Promise.all([
									summaryQuery.refetch(),
									ledgerQuery.refetch(),
									webhooksQuery.refetch(),
								])
							}}
							disabled={isRefreshing}
						>
							<RefreshCw className={isRefreshing ? "animate-spin" : ""} />
							Refresh data
						</Button>
					</div>

					<TabsContent value="ledger" className="mt-0">
						<div className="space-y-4 border-b px-4 py-4">
							<div className="flex flex-wrap gap-2">
								{presetOptions.map((option) => (
									<Button
										key={option.value}
										type="button"
										variant={preset === option.value ? "default" : "outline"}
										size="sm"
										onClick={() => {
											startTransition(() => {
												setPreset(option.value)
												setPage(1)
											})
										}}
									>
										{option.label}
									</Button>
								))}
							</div>

							<InputGroup className="h-11">
								<InputGroupAddon align="inline-start">
									<Search className="size-4" />
								</InputGroupAddon>
								<InputGroupInput
									value={search}
									onChange={(event) => {
										startTransition(() => {
											setSearch(event.target.value)
											setPage(1)
										})
									}}
									placeholder="Search by customer, branch, payment id, rental id, or Stripe reference"
								/>
							</InputGroup>
						</div>

						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									{table.getHeaderGroups().map((group) => (
										<TableRow key={group.id}>
											{group.headers.map((header) => (
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
									{ledgerQuery.isPending ? (
										<TableRow>
											<TableCell
												colSpan={columns.length}
												className="h-20 text-center"
											>
												Loading payments ledger...
											</TableCell>
										</TableRow>
									) : ledgerQuery.isError ? (
										<TableRow>
											<TableCell
												colSpan={columns.length}
												className="h-20 text-center"
											>
												<span className="text-destructive">
													{resolveErrorMessage(
														ledgerQuery.error,
														"Failed to load the payments ledger.",
													)}
												</span>
											</TableCell>
										</TableRow>
									) : table.getRowModel().rows.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={columns.length}
												className="h-20 text-center"
											>
												No payment rows matched the current filters.
											</TableCell>
										</TableRow>
									) : (
										table.getRowModel().rows.map((row) => (
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

						<div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
							<p className="text-muted-foreground text-sm">
								Showing {ledgerQuery.data?.rows.length ?? 0} of{" "}
								{ledgerQuery.data?.page.total ?? 0} results
							</p>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										startTransition(() => {
											setPage((current) => Math.max(1, current - 1))
										})
									}}
									disabled={page <= 1}
								>
									Previous
								</Button>
								<p className="text-sm">
									Page {ledgerQuery.data?.page.page ?? page} of{" "}
									{ledgerQuery.data?.page.pageCount ?? 1}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										startTransition(() => {
											setPage((current) => current + 1)
										})
									}}
									disabled={page >= (ledgerQuery.data?.page.pageCount ?? 1)}
								>
									Next
								</Button>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="webhooks" className="mt-0">
						<div className="space-y-4 border-b px-4 py-4">
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									variant={webhookStatus === "all" ? "default" : "outline"}
									size="sm"
									onClick={() => {
										setWebhookStatus("all")
									}}
								>
									All
								</Button>
								<Button
									type="button"
									variant={webhookStatus === "failed" ? "default" : "outline"}
									size="sm"
									onClick={() => {
										setWebhookStatus("failed")
									}}
								>
									Failed only
								</Button>
							</div>
						</div>

						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Event</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Related</TableHead>
										<TableHead>Received</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{webhooksQuery.isPending ? (
										<TableRow>
											<TableCell colSpan={5} className="h-20 text-center">
												Loading webhooks...
											</TableCell>
										</TableRow>
									) : webhooksQuery.isError ? (
										<TableRow>
											<TableCell colSpan={5} className="h-20 text-center">
												<span className="text-destructive">
													{resolveErrorMessage(
														webhooksQuery.error,
														"Failed to load webhook rows.",
													)}
												</span>
											</TableCell>
										</TableRow>
									) : (webhooksQuery.data?.rows.length ?? 0) === 0 ? (
										<TableRow>
											<TableCell colSpan={5} className="h-20 text-center">
												No webhook rows matched the current filter.
											</TableCell>
										</TableRow>
									) : (
										webhooksQuery.data?.rows.map((row) => (
											<TableRow key={row.id}>
												<TableCell>
													<p className="font-medium">{row.type}</p>
													<p className="text-muted-foreground text-xs">
														{row.objectType ?? "object"} • {row.objectId ?? "-"}
													</p>
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className={webhookStatusBadgeClass(row.status)}
													>
														{row.status}
													</Badge>
													<p className="text-muted-foreground mt-1 text-xs">
														{row.mode}
													</p>
												</TableCell>
												<TableCell>
													<p className="text-sm">
														Payment {row.relatedPaymentId?.slice(0, 8) ?? "-"}
													</p>
													<p className="text-muted-foreground text-xs">
														Rental {row.relatedRentalId?.slice(0, 8) ?? "-"}
													</p>
												</TableCell>
												<TableCell>{formatDateTime(row.receivedAt)}</TableCell>
												<TableCell>
													<div className="flex flex-wrap gap-2">
														{row.relatedPaymentId ? (
															<Button
																type="button"
																variant="outline"
																size="sm"
																onClick={() => {
																	setSelectedPaymentId(row.relatedPaymentId)
																}}
															>
																Open payment
															</Button>
														) : null}
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => {
																void copyValue(
																	row.stripeEventId,
																	"Stripe event id",
																)
															}}
														>
															<WalletCards />
															Event id
														</Button>
														<details>
															<summary className="text-sm font-medium underline-offset-4 hover:underline">
																Payload
															</summary>
															<pre className="bg-muted mt-2 max-w-xl overflow-x-auto rounded-md p-3 text-xs">
																{JSON.stringify(row.payload, null, 2)}
															</pre>
														</details>
													</div>
													{row.errorMessage ? (
														<p className="mt-2 text-sm text-destructive">
															{row.errorMessage}
														</p>
													) : null}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
					</TabsContent>
				</Tabs>
			</section>

			<PaymentDetailDrawer
				paymentId={selectedPaymentId}
				open={Boolean(selectedPaymentId)}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedPaymentId(null)
					}
				}}
			/>
		</PageContentShell>
	)
}
