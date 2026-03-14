"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { routes } from "@/config/routes"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import {
	useHandoverRentalMutation,
	useRentalsListQuery,
	useReturnRentalMutation,
} from "@/features/rentals"
import { resolveErrorMessage } from "@/lib/errors"
import { RentalAppointmentDrawer } from "./rental-appointment-drawer"

const filters = {
	all: "",
	active: "active,scheduled",
	drafts: "draft,awaiting_payment",
	completed: "completed,cancelled",
} as const

type FilterKey = keyof typeof filters

function formatRecurringBillingStateLabel(
	state:
		| "none"
		| "pending_setup"
		| "ready_to_schedule"
		| "scheduled_in_stripe"
		| "active_in_stripe"
		| "past_due"
		| "failed"
		| "cancelled",
) {
	switch (state) {
		case "none":
			return "Not started"
		case "pending_setup":
			return "Pending setup"
		case "ready_to_schedule":
			return "Awaiting start"
		case "scheduled_in_stripe":
			return "Scheduled in Stripe"
		case "active_in_stripe":
			return "Active in Stripe"
		case "past_due":
			return "Past due"
		case "failed":
			return "Failed"
		case "cancelled":
			return "Cancelled"
	}
}

function recurringBillingBadgeClass(
	state:
		| "none"
		| "pending_setup"
		| "ready_to_schedule"
		| "scheduled_in_stripe"
		| "active_in_stripe"
		| "past_due"
		| "failed"
		| "cancelled",
) {
	switch (state) {
		case "active_in_stripe":
			return "border-emerald-200 bg-emerald-50 text-emerald-700"
		case "scheduled_in_stripe":
		case "ready_to_schedule":
			return "border-sky-200 bg-sky-50 text-sky-700"
		case "pending_setup":
			return "border-amber-200 bg-amber-50 text-amber-700"
		case "past_due":
		case "failed":
			return "border-destructive/30 bg-destructive/10 text-destructive"
		case "cancelled":
			return "border-border bg-muted text-muted-foreground"
		case "none":
			return "border-border bg-background text-muted-foreground"
	}
}

function formatInstallmentIntervalLabel(interval: "week" | "month" | null) {
	if (interval === "week") {
		return "Weekly"
	}

	if (interval === "month") {
		return "Monthly"
	}

	return "Single"
}

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

export function RentalManagement() {
	const router = useRouter()
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const canManagePayments = Boolean(
		authContextQuery.data?.permissions.managePaymentsModule,
	)

	const [activeFilter, setActiveFilter] = useState<FilterKey>("active")
	const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
	const [actionError, setActionError] = useState<string | null>(null)

	const rentalsQuery = useRentalsListQuery(
		activeOrganizationId,
		filters[activeFilter],
	)

	const handoverMutation = useHandoverRentalMutation(activeOrganizationId)
	const returnMutation = useReturnRentalMutation(activeOrganizationId)

	const rentals = rentalsQuery.data?.rentals ?? []

	const summary = useMemo(() => {
		const active = rentals.filter(
			(item) => item.status === "active" || item.status === "scheduled",
		).length
		const drafts = rentals.filter(
			(item) => item.status === "draft" || item.status === "awaiting_payment",
		).length
		const completed = rentals.filter(
			(item) => item.status === "completed" || item.status === "cancelled",
		).length

		return {
			active,
			drafts,
			completed,
		}
	}, [rentals])

	async function onHandover(input: {
		rentalId: string
		selectedPaymentMethodType: "cash" | "card" | "au_becs_debit" | null
		firstCollectionTiming: "setup" | "handover"
	}) {
		try {
			setActionError(null)
			const amountTendered =
				input.selectedPaymentMethodType === "cash" &&
				input.firstCollectionTiming === "handover"
					? window.prompt(
							"Enter amount tendered for the handover cash collection.",
						)
					: null

			await handoverMutation.mutateAsync({
				rentalId: input.rentalId,
				payload:
					amountTendered && amountTendered.trim().length > 0
						? {
								amountTendered: Number(amountTendered),
							}
						: {},
			})
			toast.success("Vehicle handover completed.")
		} catch (error) {
			setActionError(resolveErrorMessage(error, "Failed to hand over rental."))
		}
	}

	async function onReturn(rentalId: string) {
		try {
			setActionError(null)
			await returnMutation.mutateAsync({ rentalId, payload: {} })
			toast.success("Rental return completed.")
		} catch (error) {
			setActionError(resolveErrorMessage(error, "Failed to complete return."))
		}
	}

	return (
		<div className="space-y-4">
			<PageSectionHeader
				title="Rentals"
				description="Manage draft, scheduled, active, and completed rental operations."
			/>

			<div className="grid gap-3 md:grid-cols-3">
				<div className="rounded-md border px-4 py-3">
					<p className="text-muted-foreground text-xs">Active / Scheduled</p>
					<p className="text-2xl font-semibold">{summary.active}</p>
				</div>
				<div className="rounded-md border px-4 py-3">
					<p className="text-muted-foreground text-xs">Draft pipeline</p>
					<p className="text-2xl font-semibold">{summary.drafts}</p>
				</div>
				<div className="rounded-md border px-4 py-3">
					<p className="text-muted-foreground text-xs">Completed / Cancelled</p>
					<p className="text-2xl font-semibold">{summary.completed}</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<ToggleGroup
					type="single"
					value={activeFilter}
					onValueChange={(value) => {
						if (value && value in filters) {
							setActiveFilter(value as FilterKey)
						}
					}}
				>
					<ToggleGroupItem value="active">Active</ToggleGroupItem>
					<ToggleGroupItem value="drafts">Drafts</ToggleGroupItem>
					<ToggleGroupItem value="completed">Completed</ToggleGroupItem>
					<ToggleGroupItem value="all">All</ToggleGroupItem>
				</ToggleGroup>

				<Button className="h-11" onClick={() => setIsCreateDrawerOpen(true)}>
					New rental
				</Button>
			</div>

			{actionError ? (
				<p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{actionError}
				</p>
			) : null}

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Rental</TableHead>
							<TableHead>Customer</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Plan</TableHead>
							<TableHead>Schedule</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rentalsQuery.isPending ? (
							<TableRow>
								<TableCell colSpan={6} className="h-16 text-center">
									Loading rentals...
								</TableCell>
							</TableRow>
						) : rentals.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="h-16 text-center">
									No rentals found for this filter.
								</TableCell>
							</TableRow>
						) : (
							rentals.map((rental) => (
								<TableRow
									key={rental.id}
									className="cursor-pointer"
									onClick={() => {
										router.push(routes.app.rentalDetails(rental.id))
									}}
								>
									<TableCell>
										<p className="font-medium">
											{rental.vehicle?.label ?? "Vehicle pending"}
										</p>
										<p className="text-muted-foreground text-xs">
											{rental.vehicle?.licensePlate ?? "No plate"}
										</p>
									</TableCell>
									<TableCell>
										<p className="font-medium">
											{rental.customer?.fullName ?? "Customer pending"}
										</p>
										<p className="text-muted-foreground text-xs">
											{rental.customer?.email ?? rental.customer?.phone ?? "-"}
										</p>
									</TableCell>
									<TableCell>
										<Badge
											variant="outline"
											className={rentalStatusBadgeClass(rental.status)}
										>
											{rental.status.replaceAll("_", " ")}
										</Badge>
									</TableCell>
									<TableCell>
										<p className="text-sm capitalize">
											{rental.paymentPlanKind}
										</p>
										<p className="text-muted-foreground text-xs capitalize">
											{rental.firstCollectionTiming.replaceAll("_", " ")}
											{rental.selectedPaymentMethodType
												? ` • ${rental.selectedPaymentMethodType.replaceAll("_", " ")}`
												: ""}
										</p>
										{rental.paymentPlanKind === "installment" ? (
											<div className="mt-2 flex flex-wrap gap-2">
												<Badge variant="outline">
													{formatInstallmentIntervalLabel(
														rental.installmentInterval,
													)}
												</Badge>
												<Badge
													variant="outline"
													className={recurringBillingBadgeClass(
														rental.recurringBillingState,
													)}
												>
													{formatRecurringBillingStateLabel(
														rental.recurringBillingState,
													)}
												</Badge>
												{rental.selectedPaymentMethodType &&
												rental.selectedPaymentMethodType !== "cash" ? (
													<Badge variant="outline">
														Method {rental.storedPaymentMethodStatus}
													</Badge>
												) : null}
											</div>
										) : null}
									</TableCell>
									<TableCell>
										<p className="text-sm">
											{rental.plannedStartAt
												? new Date(rental.plannedStartAt).toLocaleString()
												: "Not scheduled"}
										</p>
										<p className="text-muted-foreground text-xs">
											{rental.plannedEndAt
												? new Date(rental.plannedEndAt).toLocaleString()
												: "-"}
										</p>
									</TableCell>
									<TableCell className="text-right">
										<div className="flex flex-wrap justify-end gap-2">
											{rental.status === "scheduled" ? (
												<Button
													type="button"
													size="sm"
													onClick={(event) => {
														event.stopPropagation()
														void onHandover({
															rentalId: rental.id,
															selectedPaymentMethodType:
																rental.selectedPaymentMethodType,
															firstCollectionTiming:
																rental.firstCollectionTiming,
														})
													}}
													disabled={!canManagePayments}
												>
													Handover
												</Button>
											) : null}

											{rental.status === "active" ||
											rental.status === "scheduled" ? (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={(event) => {
														event.stopPropagation()
														void onReturn(rental.id)
													}}
												>
													Return
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

			<RentalAppointmentDrawer
				open={isCreateDrawerOpen}
				onOpenChange={setIsCreateDrawerOpen}
				onRentalFinalized={() => {
					void rentalsQuery.refetch()
				}}
			/>
		</div>
	)
}
