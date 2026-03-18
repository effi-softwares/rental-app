"use client"

import { Copy, WalletCards } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { useBillingAttentionOverviewQuery } from "@/features/billing-attention"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { resolveErrorMessage } from "@/lib/errors"

const ACTIVITY_PAGE_SIZE = 10

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

async function copyValue(value: string, label: string) {
	try {
		await navigator.clipboard.writeText(value)
		toast.success(`${label} copied.`)
	} catch (error) {
		toast.error(resolveErrorMessage(error, `Failed to copy ${label}.`))
	}
}

function paginateRows<Row>(rows: Row[], page: number) {
	const pageCount = Math.max(1, Math.ceil(rows.length / ACTIVITY_PAGE_SIZE))
	const currentPage = Math.min(page, pageCount)
	const startIndex = (currentPage - 1) * ACTIVITY_PAGE_SIZE

	return {
		currentPage,
		pageCount,
		startIndex,
		endIndex: Math.min(startIndex + ACTIVITY_PAGE_SIZE, rows.length),
		rows: rows.slice(startIndex, startIndex + ACTIVITY_PAGE_SIZE),
	}
}

function PaginationFooter({
	count,
	currentPage,
	pageCount,
	onPrevious,
	onNext,
}: {
	count: number
	currentPage: number
	pageCount: number
	onPrevious: () => void
	onNext: () => void
}) {
	const startLabel =
		count === 0 ? 0 : (currentPage - 1) * ACTIVITY_PAGE_SIZE + 1
	const endLabel = Math.min(currentPage * ACTIVITY_PAGE_SIZE, count)

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
			<p className="text-muted-foreground text-sm">
				Showing {startLabel}-{endLabel} of {count} results
			</p>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={onPrevious}
					disabled={currentPage <= 1}
				>
					Previous
				</Button>
				<p className="text-sm">
					Page {currentPage} of {pageCount}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={onNext}
					disabled={currentPage >= pageCount}
				>
					Next
				</Button>
			</div>
		</div>
	)
}

export function BillingAttentionOperations() {
	const authContextQuery = useAuthContextQuery()
	const organizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const overviewQuery = useBillingAttentionOverviewQuery(organizationId)
	const summary = overviewQuery.data?.summary
	const [attentionPage, setAttentionPage] = useState(1)
	const [webhookPage, setWebhookPage] = useState(1)
	const attentionRows = overviewQuery.data?.recentAttentionEvents ?? []
	const webhookRows = overviewQuery.data?.recentWebhookEvents ?? []
	const paginatedAttentionRows = paginateRows(attentionRows, attentionPage)
	const paginatedWebhookRows = paginateRows(webhookRows, webhookPage)

	useEffect(() => {
		const nextPageCount = Math.max(
			1,
			Math.ceil(attentionRows.length / ACTIVITY_PAGE_SIZE),
		)
		setAttentionPage((current) => (current > nextPageCount ? nextPageCount : 1))
	}, [attentionRows.length])

	useEffect(() => {
		const nextPageCount = Math.max(
			1,
			Math.ceil(webhookRows.length / ACTIVITY_PAGE_SIZE),
		)
		setWebhookPage((current) => (current > nextPageCount ? nextPageCount : 1))
	}, [webhookRows.length])

	return (
		<PageContentShell>
			<PageSectionHeader
				title="Billing Attention"
				description="Monitor Stripe webhook health, live billing attention exceptions, and recent high-attention events."
			/>

			<div className="grid gap-3 md:grid-cols-4">
				<div className="rounded-md border px-4 py-3">
					<p className="text-muted-foreground text-xs">Open attention</p>
					<p className="text-2xl font-semibold">
						{summary?.openAttentionCount ?? 0}
					</p>
				</div>
				<div className="rounded-md border px-4 py-3">
					<p className="text-muted-foreground text-xs">Awaiting payment</p>
					<p className="text-2xl font-semibold">
						{summary?.rentalsAwaitingPaymentCount ?? 0}
					</p>
				</div>
				<div className="rounded-md border px-4 py-3">
					<p className="text-muted-foreground text-xs">Requires action</p>
					<p className="text-2xl font-semibold">
						{summary?.requiresActionPaymentsCount ?? 0}
					</p>
				</div>
				<div className="rounded-md border px-4 py-3">
					<p className="text-muted-foreground text-xs">Pending direct debit</p>
					<p className="text-2xl font-semibold">
						{summary?.pendingDirectDebitCount ?? 0}
					</p>
				</div>
			</div>

			<section className="rounded-lg border">
				<Tabs defaultValue="attention" className="space-y-0">
					<div className="px-4 pt-3">
						<TabsList className="h-auto w-full flex-wrap justify-start">
							<TabsTrigger value="attention" className="flex-none">
								Attention events
							</TabsTrigger>
							<TabsTrigger value="webhooks" className="flex-none">
								Webhook activity
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="attention" className="mt-3">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Summary</TableHead>
										<TableHead>Attention</TableHead>
										<TableHead>Entity</TableHead>
										<TableHead>Created</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{overviewQuery.isPending ? (
										<TableRow>
											<TableCell colSpan={5} className="h-16 text-center">
												Loading attention events...
											</TableCell>
										</TableRow>
									) : overviewQuery.isError ? (
										<TableRow>
											<TableCell colSpan={5} className="h-16 text-center">
												<span className="text-destructive">
													{resolveErrorMessage(
														overviewQuery.error,
														"Failed to load attention events.",
													)}
												</span>
											</TableCell>
										</TableRow>
									) : attentionRows.length === 0 ? (
										<TableRow>
											<TableCell colSpan={5} className="h-16 text-center">
												No live attention events yet.
											</TableCell>
										</TableRow>
									) : (
										paginatedAttentionRows.rows.map((event) => (
											<TableRow key={event.id}>
												<TableCell>
													<p className="font-medium">
														{event.summary ?? event.eventType}
													</p>
													<p className="text-muted-foreground text-xs">
														{event.eventType}
													</p>
												</TableCell>
												<TableCell className="uppercase">
													{event.attention}
												</TableCell>
												<TableCell>
													<p className="text-sm">{event.entityType}</p>
													<p className="text-muted-foreground font-mono text-xs">
														{event.entityId}
													</p>
												</TableCell>
												<TableCell className="text-sm">
													{formatDateTime(event.createdAt)}
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap justify-end gap-2">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => {
																void copyValue(
																	event.stripeEventId ?? event.entityId,
																	event.stripeEventId
																		? "Stripe event id"
																		: "Entity id",
																)
															}}
														>
															<Copy />
															{event.stripeEventId ? "Event id" : "Entity id"}
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
						<PaginationFooter
							count={attentionRows.length}
							currentPage={paginatedAttentionRows.currentPage}
							pageCount={paginatedAttentionRows.pageCount}
							onPrevious={() => {
								setAttentionPage((current) => Math.max(1, current - 1))
							}}
							onNext={() => {
								setAttentionPage((current) =>
									Math.min(paginatedAttentionRows.pageCount, current + 1),
								)
							}}
						/>
					</TabsContent>

					<TabsContent value="webhooks" className="mt-3">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Event</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Object</TableHead>
										<TableHead>Received</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{overviewQuery.isPending ? (
										<TableRow>
											<TableCell colSpan={5} className="h-16 text-center">
												Loading webhook activity...
											</TableCell>
										</TableRow>
									) : overviewQuery.isError ? (
										<TableRow>
											<TableCell colSpan={5} className="h-16 text-center">
												<span className="text-destructive">
													{resolveErrorMessage(
														overviewQuery.error,
														"Failed to load webhook activity.",
													)}
												</span>
											</TableCell>
										</TableRow>
									) : webhookRows.length === 0 ? (
										<TableRow>
											<TableCell colSpan={5} className="h-16 text-center">
												No Stripe webhook events yet.
											</TableCell>
										</TableRow>
									) : (
										paginatedWebhookRows.rows.map((event) => (
											<TableRow key={event.id}>
												<TableCell>
													<p className="font-medium">{event.type}</p>
													<p className="text-muted-foreground text-xs">
														{event.mode}
													</p>
												</TableCell>
												<TableCell className="uppercase">
													{event.status.replaceAll("_", " ")}
												</TableCell>
												<TableCell>
													<p className="text-sm">
														{event.objectType ?? "Unknown object"}
													</p>
													<p className="text-muted-foreground font-mono text-xs">
														{event.objectId ?? "-"}
													</p>
												</TableCell>
												<TableCell className="text-sm">
													{formatDateTime(event.receivedAt)}
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap justify-end gap-2">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => {
																void copyValue(
																	event.stripeEventId,
																	"Stripe event id",
																)
															}}
														>
															<WalletCards />
															Event id
														</Button>
														{event.objectId ? (
															<Button
																type="button"
																variant="ghost"
																size="sm"
																onClick={() => {
																	void copyValue(
																		event.objectId ?? "",
																		"Stripe object id",
																	)
																}}
															>
																<Copy />
																Object id
															</Button>
														) : null}
													</div>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
						<PaginationFooter
							count={webhookRows.length}
							currentPage={paginatedWebhookRows.currentPage}
							pageCount={paginatedWebhookRows.pageCount}
							onPrevious={() => {
								setWebhookPage((current) => Math.max(1, current - 1))
							}}
							onNext={() => {
								setWebhookPage((current) =>
									Math.min(paginatedWebhookRows.pageCount, current + 1),
								)
							}}
						/>
					</TabsContent>
				</Tabs>
			</section>
		</PageContentShell>
	)
}
