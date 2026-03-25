"use client"

import { ExternalLink, Link2, ReceiptText, RefreshCw } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useMemo } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { routes } from "@/config/routes"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { usePaymentDetailQuery } from "@/features/payments"
import { resolveErrorMessage } from "@/lib/errors"
import { statusToneClassName } from "@/lib/theme-styles"

type PaymentDetailDrawerProps = {
	paymentId: string | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

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

function paymentStatusBadgeClass(status: string) {
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

function webhookStatusBadgeClass(status: string) {
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

async function copyToClipboard(value: string, label: string) {
	try {
		await navigator.clipboard.writeText(value)
		toast.success(`${label} copied.`)
	} catch (error) {
		toast.error(resolveErrorMessage(error, `Failed to copy ${label}.`))
	}
}

function DetailValueCard({
	label,
	value,
	hint,
	mono = false,
	action,
	icon,
}: {
	label: string
	value: string
	hint?: string | null
	mono?: boolean
	action?: ReactNode
	icon?: ReactNode
}) {
	return (
		<div className="rounded-lg border p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p className="text-muted-foreground text-xs">{label}</p>
					<p
						className={
							mono ? "mt-1 truncate font-mono text-xs" : "mt-1 font-medium"
						}
					>
						{value}
					</p>
					{hint ? (
						<p className="text-muted-foreground text-xs">{hint}</p>
					) : null}
				</div>
				{icon ? (
					<div className="text-muted-foreground shrink-0">{icon}</div>
				) : null}
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
		</div>
	)
}

export function PaymentDetailDrawer({
	paymentId,
	open,
	onOpenChange,
}: PaymentDetailDrawerProps) {
	const authContextQuery = useAuthContextQuery()
	const organizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const detailQuery = usePaymentDetailQuery(organizationId, paymentId, open)

	const title = useMemo(() => {
		if (!detailQuery.data?.selectedPayment) {
			return "Payment detail"
		}

		return `Payment ${detailQuery.data.selectedPayment.id.slice(0, 8)}`
	}, [detailQuery.data?.selectedPayment])

	return (
		<ResponsiveDrawer
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description="Inspect local payment records, related schedule and invoice context, webhook deliveries, and rental audit events."
			desktopClassName="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
			mobileClassName="max-h-[94vh] overflow-y-auto rounded-t-2xl p-0"
		>
			<div className="space-y-6">
				<div className="flex flex-wrap items-center justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							void detailQuery.refetch()
						}}
						disabled={detailQuery.isFetching}
					>
						<RefreshCw
							className={detailQuery.isFetching ? "animate-spin" : ""}
						/>
						Refresh
					</Button>
					{detailQuery.data?.selectedPayment ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								void copyToClipboard(
									detailQuery.data?.selectedPayment.id ?? "",
									"Payment id",
								)
							}}
						>
							<Link2 />
							Copy payment id
						</Button>
					) : null}
					{detailQuery.data?.rental ? (
						<Button asChild variant="outline" size="sm">
							<Link href={routes.app.rentalDetails(detailQuery.data.rental.id)}>
								<ExternalLink />
								Open rental
							</Link>
						</Button>
					) : null}
				</div>

				{detailQuery.isPending ? (
					<p className="text-muted-foreground text-sm">
						Loading payment detail...
					</p>
				) : detailQuery.isError ? (
					<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{resolveErrorMessage(
							detailQuery.error,
							"Failed to load payment detail.",
						)}
					</p>
				) : detailQuery.data ? (
					<Tabs
						key={`${open ? "open" : "closed"}-${paymentId ?? "none"}`}
						defaultValue="overview"
						className="space-y-4"
					>
						<TabsList
							variant="line"
							className="h-auto w-full flex-wrap justify-start"
						>
							<TabsTrigger value="overview" className="flex-none">
								Overview
							</TabsTrigger>
							<TabsTrigger value="billing" className="flex-none">
								Billing
							</TabsTrigger>
							<TabsTrigger value="activity" className="flex-none">
								Activity
							</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="mt-0 space-y-4">
							<section className="space-y-4 rounded-xl border p-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<p className="font-medium">Selected payment</p>
										<p className="text-muted-foreground text-sm">
											{detailQuery.data.selectedPayment.kind.replaceAll(
												"_",
												" ",
											)}
										</p>
									</div>
									<Badge
										variant="outline"
										className={paymentStatusBadgeClass(
											detailQuery.data.selectedPayment.status,
										)}
									>
										{detailQuery.data.selectedPayment.status.replaceAll(
											"_",
											" ",
										)}
									</Badge>
								</div>

								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									<DetailValueCard
										label="Amount"
										value={formatCurrency(
											detailQuery.data.selectedPayment.amount,
											detailQuery.data.selectedPayment.currency,
										)}
									/>
									<DetailValueCard
										label="Method"
										value={
											detailQuery.data.selectedPayment.paymentMethodType ?? "-"
										}
									/>
									<DetailValueCard
										label="Captured"
										value={formatDateTime(
											detailQuery.data.selectedPayment.capturedAt,
										)}
									/>
									<DetailValueCard
										label="Branch"
										value={
											detailQuery.data.selectedPayment.branchName ??
											"Unassigned"
										}
									/>
								</div>
							</section>

							<section className="space-y-4 rounded-xl border p-4">
								<div className="space-y-1">
									<p className="font-medium">Rental context</p>
									<p className="text-muted-foreground text-sm">
										{detailQuery.data.rental.customerName ?? "Unknown customer"}{" "}
										• {detailQuery.data.rental.status.replaceAll("_", " ")}
									</p>
								</div>

								<div className="grid gap-3 sm:grid-cols-2">
									<DetailValueCard
										label="Payment plan"
										value={detailQuery.data.rental.paymentPlanKind}
									/>
									<DetailValueCard
										label="Recurring billing"
										value={detailQuery.data.rental.recurringBillingState.replaceAll(
											"_",
											" ",
										)}
									/>
									<DetailValueCard
										label="Rental window"
										value={formatDateTime(
											detailQuery.data.rental.plannedStartAt,
										)}
										hint={`to ${formatDateTime(
											detailQuery.data.rental.plannedEndAt,
										)}`}
									/>
									<DetailValueCard
										label="Customer"
										value={detailQuery.data.rental.customerEmail ?? "-"}
										hint={detailQuery.data.rental.customerId ?? null}
									/>
								</div>
							</section>

							<section className="space-y-3 rounded-xl border p-4">
								<p className="font-medium">Schedule snapshot</p>
								{detailQuery.data.fullSchedule.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										No scheduled charges were found for this payment.
									</p>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Charge</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Due</TableHead>
												<TableHead className="text-right">Amount</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{detailQuery.data.fullSchedule.map((row) => (
												<TableRow key={row.id}>
													<TableCell>
														<p className="font-medium">{row.label}</p>
														<p className="text-muted-foreground text-xs">
															#{row.sequence}
														</p>
														{row.failureReason ? (
															<p className="text-xs text-destructive">
																{row.failureReason}
															</p>
														) : null}
													</TableCell>
													<TableCell>
														{row.status.replaceAll("_", " ")}
													</TableCell>
													<TableCell>{formatDateTime(row.dueAt)}</TableCell>
													<TableCell className="text-right">
														{formatCurrency(row.amount, row.currency)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</section>
						</TabsContent>

						<TabsContent value="billing" className="mt-0 space-y-4">
							<section className="space-y-3 rounded-xl border p-4">
								<p className="font-medium">Stripe and local references</p>
								<div className="grid gap-2 sm:grid-cols-2">
									{(
										[
											{
												label: "Payment intent",
												value: detailQuery.data.selectedPayment.paymentIntentId,
											},
											{
												label: "Setup intent",
												value: detailQuery.data.selectedPayment.setupIntentId,
											},
											{
												label: "Stripe invoice",
												value: detailQuery.data.selectedPayment.invoiceId,
											},
											{
												label: "Subscription",
												value: detailQuery.data.selectedPayment.subscriptionId,
											},
											{
												label: "Schedule",
												value:
													detailQuery.data.selectedPayment
														.subscriptionScheduleId,
											},
											{
												label: "Payment method",
												value: detailQuery.data.selectedPayment.paymentMethodId,
											},
											{
												label: "Manual reference",
												value: detailQuery.data.selectedPayment.manualReference,
											},
											{
												label: "External reference",
												value:
													detailQuery.data.selectedPayment.externalReference,
											},
										] as const
									).map((entry) => (
										<DetailValueCard
											key={entry.label}
											label={entry.label}
											value={entry.value ?? "-"}
											mono
											action={
												entry.value ? (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => {
															if (!entry.value) {
																return
															}

															void copyToClipboard(entry.value, entry.label)
														}}
													>
														Copy
													</Button>
												) : null
											}
										/>
									))}
								</div>
							</section>

							<section className="space-y-3 rounded-xl border p-4">
								<p className="font-medium">Invoice</p>
								{detailQuery.data.relatedInvoice ? (
									<div className="grid gap-3 sm:grid-cols-2">
										<DetailValueCard
											label="Amount"
											value={formatCurrency(
												detailQuery.data.relatedInvoice.total,
												detailQuery.data.relatedInvoice.currency,
											)}
											icon={<ReceiptText className="size-4" />}
										/>
										<DetailValueCard
											label="Status"
											value={detailQuery.data.relatedInvoice.status.replaceAll(
												"_",
												" ",
											)}
										/>
										<DetailValueCard
											label="Collection method"
											value={detailQuery.data.relatedInvoice.collectionMethod.replaceAll(
												"_",
												" ",
											)}
										/>
										<DetailValueCard
											label="Due"
											value={formatDateTime(
												detailQuery.data.relatedInvoice.dueAt,
											)}
											hint={
												detailQuery.data.relatedInvoice.issuedAt
													? `Issued ${formatDateTime(
															detailQuery.data.relatedInvoice.issuedAt,
														)}`
													: null
											}
										/>
										<div className="rounded-lg border p-3 sm:col-span-2">
											<p className="text-muted-foreground text-xs">Links</p>
											<div className="mt-3 flex flex-wrap gap-2">
												{detailQuery.data.relatedInvoice.hostedInvoiceUrl ? (
													<Button asChild variant="outline" size="sm">
														<a
															href={
																detailQuery.data.relatedInvoice.hostedInvoiceUrl
															}
															target="_blank"
															rel="noreferrer"
														>
															<ExternalLink />
															Hosted invoice
														</a>
													</Button>
												) : null}
												{detailQuery.data.relatedInvoice.invoicePdfUrl ? (
													<Button asChild variant="outline" size="sm">
														<a
															href={
																detailQuery.data.relatedInvoice.invoicePdfUrl
															}
															target="_blank"
															rel="noreferrer"
														>
															<ExternalLink />
															PDF
														</a>
													</Button>
												) : null}
											</div>
										</div>
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										No related invoice is linked to this payment.
									</p>
								)}
							</section>

							<section className="space-y-3 rounded-xl border p-4">
								<p className="font-medium">Related payments</p>
								{detailQuery.data.relatedPayments.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										No related payments were found.
									</p>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Status</TableHead>
												<TableHead>Method</TableHead>
												<TableHead>Amount</TableHead>
												<TableHead>Created</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{detailQuery.data.relatedPayments.map((payment) => (
												<TableRow key={payment.id}>
													<TableCell>
														<Badge
															variant="outline"
															className={paymentStatusBadgeClass(
																payment.status,
															)}
														>
															{payment.status.replaceAll("_", " ")}
														</Badge>
													</TableCell>
													<TableCell>
														{payment.paymentMethodType ?? "-"} /{" "}
														{payment.collectionSurface ?? "-"}
													</TableCell>
													<TableCell>
														{formatCurrency(payment.amount, payment.currency)}
													</TableCell>
													<TableCell>
														{formatDateTime(payment.createdAt)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</section>
						</TabsContent>

						<TabsContent value="activity" className="mt-0 space-y-4">
							<section className="space-y-3 rounded-xl border p-4">
								<p className="font-medium">Correlated webhooks</p>
								<div className="space-y-3">
									{detailQuery.data.correlatedWebhooks.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											No correlated Stripe webhook events were found for this
											payment.
										</p>
									) : (
										detailQuery.data.correlatedWebhooks.map((webhook) => (
											<div key={webhook.id} className="rounded-lg border p-3">
												<div className="flex items-center justify-between gap-3">
													<div>
														<p className="font-medium">{webhook.type}</p>
														<p className="text-muted-foreground text-xs">
															{webhook.objectType ?? "object"} •{" "}
															{webhook.objectId ?? "-"}
														</p>
													</div>
													<Badge
														variant="outline"
														className={webhookStatusBadgeClass(webhook.status)}
													>
														{webhook.status}
													</Badge>
												</div>
												<p className="text-muted-foreground mt-2 text-xs">
													Received {formatDateTime(webhook.receivedAt)}
												</p>
												{webhook.errorMessage ? (
													<p className="mt-2 text-sm text-destructive">
														{webhook.errorMessage}
													</p>
												) : null}
												<details className="mt-3">
													<summary className="cursor-pointer text-sm font-medium">
														Inspect payload
													</summary>
													<pre className="bg-muted mt-2 overflow-x-auto rounded-md p-3 text-xs">
														{JSON.stringify(webhook.payload, null, 2)}
													</pre>
												</details>
											</div>
										))
									)}
								</div>
							</section>

							<section className="space-y-3 rounded-xl border p-4">
								<p className="font-medium">Rental audit events</p>
								<div className="space-y-3">
									{detailQuery.data.relatedRentalEvents.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											No rental events were recorded.
										</p>
									) : (
										detailQuery.data.relatedRentalEvents.map((event) => (
											<div key={event.id} className="rounded-lg border p-3">
												<p className="font-medium">{event.type}</p>
												<p className="text-muted-foreground mt-1 text-xs">
													{formatDateTime(event.createdAt)}
												</p>
												<details className="mt-3">
													<summary className="cursor-pointer text-sm font-medium">
														View payload
													</summary>
													<pre className="bg-muted mt-2 overflow-x-auto rounded-md p-3 text-xs">
														{JSON.stringify(event.payload, null, 2)}
													</pre>
												</details>
											</div>
										))
									)}
								</div>
							</section>
						</TabsContent>
					</Tabs>
				) : null}
			</div>
		</ResponsiveDrawer>
	)
}
