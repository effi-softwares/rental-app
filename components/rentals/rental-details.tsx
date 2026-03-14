"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { VehicleLiveLocationTab } from "@/components/fleet/vehicle-live-location-tab"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { Textarea } from "@/components/ui/textarea"
import { routes } from "@/config/routes"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import {
	type RentalChargeKind,
	type RentalDamageCategory,
	type RentalDamageSeverity,
	useCollectCashPaymentMutation,
	useCollectRentalChargeMutation,
	useCreateRentalChargeMutation,
	useExtendRentalMutation,
	useFinalizeRentalMutation,
	useHandoverRentalMutation,
	usePrepareRentalPaymentMutation,
	useRentalDraftQuery,
	useResolveRentalDepositMutation,
	useReturnRentalMutation,
	useSaveRentalInspectionMutation,
} from "@/features/rentals"
import { resolveErrorMessage } from "@/lib/errors"
import { isPrivilegedFleetRole } from "@/lib/fleet/live"
import { RentalAppointmentDrawer } from "./rental-appointment-drawer"
import { RentalPaymentAuBecsForm } from "./rental-payment-au-becs-form"
import { RentalPaymentTerminalPanel } from "./rental-payment-terminal-panel"

type RentalDetailsProps = {
	rentalId: string
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

function chargeStatusBadgeClass(
	status: "open" | "partially_paid" | "paid" | "cancelled",
) {
	switch (status) {
		case "paid":
			return "border-emerald-200 bg-emerald-50 text-emerald-700"
		case "partially_paid":
			return "border-amber-200 bg-amber-50 text-amber-700"
		case "cancelled":
			return "border-destructive/30 bg-destructive/10 text-destructive"
		case "open":
			return "border-border bg-background text-muted-foreground"
	}
}

function paymentStatusBadgeClass(
	status:
		| "pending"
		| "requires_action"
		| "processing"
		| "succeeded"
		| "failed"
		| "refunded"
		| "cancelled",
) {
	switch (status) {
		case "succeeded":
			return "border-emerald-200 bg-emerald-50 text-emerald-700"
		case "processing":
		case "pending":
			return "border-sky-200 bg-sky-50 text-sky-700"
		case "requires_action":
			return "border-amber-200 bg-amber-50 text-amber-700"
		case "failed":
		case "cancelled":
		case "refunded":
			return "border-destructive/30 bg-destructive/10 text-destructive"
	}
}

function SummaryStat({
	label,
	value,
	subtitle,
}: {
	label: string
	value: string
	subtitle?: string
}) {
	return (
		<div className="rounded-lg border px-4 py-3">
			<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
				{label}
			</p>
			<p className="mt-2 text-2xl font-semibold">{value}</p>
			{subtitle ? (
				<p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
			) : null}
		</div>
	)
}

function SectionEmpty({ message }: { message: string }) {
	return <p className="text-muted-foreground text-sm">{message}</p>
}

export function RentalDetails({ rentalId }: RentalDetailsProps) {
	const authContextQuery = useAuthContextQuery()
	const organizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const canManagePayments = Boolean(
		authContextQuery.data?.permissions.managePaymentsModule,
	)
	const canViewLive =
		Boolean(authContextQuery.data?.permissions.viewFleetModule) &&
		isPrivilegedFleetRole(authContextQuery.data?.viewer.role)

	const rentalDetailQuery = useRentalDraftQuery(organizationId, rentalId)
	const finalizeMutation = useFinalizeRentalMutation(organizationId)
	const preparePaymentMutation = usePrepareRentalPaymentMutation(organizationId)
	const collectCashMutation = useCollectCashPaymentMutation(organizationId)
	const handoverMutation = useHandoverRentalMutation(organizationId)
	const returnMutation = useReturnRentalMutation(organizationId)
	const inspectionMutation = useSaveRentalInspectionMutation(organizationId)
	const extendMutation = useExtendRentalMutation(organizationId)
	const createChargeMutation = useCreateRentalChargeMutation(organizationId)
	const collectChargeMutation = useCollectRentalChargeMutation(organizationId)
	const resolveDepositMutation = useResolveRentalDepositMutation(organizationId)

	const detail = rentalDetailQuery.data
	const [activeTab, setActiveTab] = useState("overview")
	const [isEditOpen, setIsEditOpen] = useState(false)
	const [selectedScheduleId, setSelectedScheduleId] = useState<string>("")
	const [paymentMethodType, setPaymentMethodType] = useState<
		"cash" | "card" | "au_becs_debit"
	>("cash")
	const [amountTendered, setAmountTendered] = useState("")
	const [paymentSession, setPaymentSession] = useState<{
		mode: "payment" | "setup"
		clientSecret: string
		intentId: string
		paymentMethodType: "card" | "au_becs_debit"
		collectionSurface: "terminal_reader" | "direct_debit"
	} | null>(null)
	const [signerName, setSignerName] = useState("")
	const [signature, setSignature] = useState("")
	const [pickupNotes, setPickupNotes] = useState("")
	const [pickupOdometer, setPickupOdometer] = useState("")
	const [pickupFuelPercent, setPickupFuelPercent] = useState("")
	const [pickupDamageTitle, setPickupDamageTitle] = useState("")
	const [pickupDamageCategory, setPickupDamageCategory] =
		useState<RentalDamageCategory>("exterior")
	const [pickupDamageSeverity, setPickupDamageSeverity] =
		useState<RentalDamageSeverity>("minor")
	const [returnNotes, setReturnNotes] = useState("")
	const [returnOdometer, setReturnOdometer] = useState("")
	const [returnFuelPercent, setReturnFuelPercent] = useState("")
	const [returnDamageTitle, setReturnDamageTitle] = useState("")
	const [returnDamageCategory, setReturnDamageCategory] =
		useState<RentalDamageCategory>("exterior")
	const [returnDamageSeverity, setReturnDamageSeverity] =
		useState<RentalDamageSeverity>("minor")
	const [extensionDate, setExtensionDate] = useState("")
	const [extensionReason, setExtensionReason] = useState("")
	const [returnCloseNotes, setReturnCloseNotes] = useState("")
	const [newChargeKind, setNewChargeKind] = useState<RentalChargeKind>("damage")
	const [newChargeAmount, setNewChargeAmount] = useState("")
	const [newChargeTaxAmount, setNewChargeTaxAmount] = useState("")
	const [newChargeDescription, setNewChargeDescription] = useState("")
	const [depositAction, setDepositAction] = useState<
		"release" | "refund" | "retain" | "apply_to_charge"
	>("release")
	const [depositAmount, setDepositAmount] = useState("")
	const [depositChargeId, setDepositChargeId] = useState("")
	const [depositNote, setDepositNote] = useState("")

	useEffect(() => {
		if (!detail) {
			return
		}

		const firstPendingSchedule =
			detail.paymentSchedule.find((row) => row.status !== "succeeded") ??
			detail.paymentSchedule[0]

		setSelectedScheduleId(
			(current) => current || firstPendingSchedule?.id || "",
		)
		setPaymentMethodType(detail.rental.selectedPaymentMethodType ?? "cash")
		setExtensionDate(
			detail.rental.plannedEndAt
				? new Date(detail.rental.plannedEndAt).toISOString().slice(0, 16)
				: "",
		)
	}, [detail])

	async function handlePreparePayment() {
		if (!selectedScheduleId) {
			toast.error("Select a schedule row first.")
			return
		}

		try {
			const result = await preparePaymentMutation.mutateAsync({
				rentalId,
				payload: {
					paymentMethodType,
					scheduleId: selectedScheduleId,
				},
			})

			setPaymentSession(result.paymentSession)
			toast.success("Payment flow prepared.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to prepare payment."))
		}
	}

	async function handleCollectCash() {
		if (!selectedScheduleId) {
			toast.error("Select a schedule row first.")
			return
		}

		try {
			await collectCashMutation.mutateAsync({
				rentalId,
				payload: {
					scheduleId: selectedScheduleId,
					amountTendered: Number(amountTendered),
				},
			})
			setAmountTendered("")
			toast.success("Cash payment collected.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to collect cash payment."))
		}
	}

	async function handleFinalize() {
		try {
			await finalizeMutation.mutateAsync({
				rentalId,
				payload: {
					signerName,
					signature,
					agreementAccepted: true,
				},
			})
			setSignature("")
			toast.success("Rental finalized.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to finalize rental."))
		}
	}

	async function handleHandover() {
		try {
			await handoverMutation.mutateAsync({
				rentalId,
				payload:
					detail?.rental.selectedPaymentMethodType === "cash" &&
					detail.rental.firstCollectionTiming === "handover" &&
					amountTendered
						? {
								amountTendered: Number(amountTendered),
							}
						: {},
			})
			toast.success("Rental handed over.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to hand over rental."))
		}
	}

	async function handleSaveInspection(stage: "pickup" | "return") {
		try {
			const isPickup = stage === "pickup"
			await inspectionMutation.mutateAsync({
				rentalId,
				stage,
				payload: {
					stage,
					odometerKm: Number(
						isPickup ? pickupOdometer || "0" : returnOdometer || "0",
					),
					fuelPercent: Number(
						isPickup ? pickupFuelPercent || "0" : returnFuelPercent || "0",
					),
					cleanliness: "clean",
					notes: isPickup ? pickupNotes : returnNotes,
					damages:
						(isPickup ? pickupDamageTitle : returnDamageTitle).trim().length > 0
							? [
									{
										category: isPickup
											? pickupDamageCategory
											: returnDamageCategory,
										title: isPickup ? pickupDamageTitle : returnDamageTitle,
										severity: isPickup
											? pickupDamageSeverity
											: returnDamageSeverity,
									},
								]
							: [],
				},
			})
			if (isPickup) {
				setPickupNotes("")
				setPickupOdometer("")
				setPickupFuelPercent("")
				setPickupDamageTitle("")
			} else {
				setReturnNotes("")
				setReturnOdometer("")
				setReturnFuelPercent("")
				setReturnDamageTitle("")
			}
			toast.success(
				isPickup ? "Pickup inspection saved." : "Return inspection saved.",
			)
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to save inspection."))
		}
	}

	async function handleExtend() {
		try {
			await extendMutation.mutateAsync({
				rentalId,
				payload: {
					nextPlannedEndAt: new Date(extensionDate).toISOString(),
					reason: extensionReason,
				},
			})
			toast.success("Rental extended.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to extend rental."))
		}
	}

	async function handleCreateCharge() {
		try {
			await createChargeMutation.mutateAsync({
				rentalId,
				payload: {
					kind: newChargeKind,
					amount: Number(newChargeAmount),
					taxAmount: Number(newChargeTaxAmount || "0"),
					description: newChargeDescription,
				},
			})
			setNewChargeAmount("")
			setNewChargeTaxAmount("")
			setNewChargeDescription("")
			toast.success("Charge created.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to create charge."))
		}
	}

	async function handleCollectCharge(chargeId: string) {
		const paymentMethod = window.prompt(
			"Collect charge with `cash` or `card`?",
			"cash",
		)

		if (paymentMethod !== "cash" && paymentMethod !== "card") {
			return
		}

		const tendered =
			paymentMethod === "cash" ? window.prompt("Amount tendered", "") : null

		try {
			await collectChargeMutation.mutateAsync({
				rentalId,
				chargeId,
				payload: {
					paymentMethodType: paymentMethod,
					amountTendered: tendered ? Number(tendered) : undefined,
				},
			})
			toast.success("Charge collected.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to collect charge."))
		}
	}

	async function handleResolveDeposit() {
		try {
			await resolveDepositMutation.mutateAsync({
				rentalId,
				payload:
					depositAction === "apply_to_charge"
						? {
								action: "apply_to_charge",
								amount: Number(depositAmount),
								chargeId: depositChargeId,
								note: depositNote,
							}
						: {
								action: depositAction,
								amount: Number(depositAmount),
								note: depositNote,
							},
			})
			setDepositAmount("")
			setDepositNote("")
			toast.success("Deposit updated.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to resolve deposit."))
		}
	}

	async function handleReturn() {
		try {
			await returnMutation.mutateAsync({
				rentalId,
				payload: {
					notes: returnCloseNotes,
				},
			})
			setReturnCloseNotes("")
			toast.success("Rental closed.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to complete return."))
		}
	}

	if (rentalDetailQuery.isPending) {
		return (
			<PageContentShell>
				<PageSectionHeader
					title="Rental Details"
					description="Loading rental operations dashboard..."
				/>
			</PageContentShell>
		)
	}

	if (!detail || rentalDetailQuery.isError) {
		return (
			<PageContentShell>
				<PageSectionHeader
					title="Rental Details"
					description="Unable to load this rental."
				/>
				<Card>
					<CardContent>
						<p className="text-destructive text-sm">
							{resolveErrorMessage(
								rentalDetailQuery.error,
								"Failed to load rental details.",
							)}
						</p>
					</CardContent>
				</Card>
			</PageContentShell>
		)
	}

	const openCharges = detail.extraCharges.filter(
		(row) => row.status === "open" || row.status === "partially_paid",
	)

	return (
		<PageContentShell className="pb-8">
			<div className="sticky top-4 z-10 rounded-2xl border bg-background/95 p-4 backdrop-blur">
				<PageSectionHeader
					title={`Rental ${detail.rental.id.slice(0, 8)}`}
					description={`${detail.customer?.fullName ?? "Customer pending"} • ${detail.vehicle?.label ?? "Vehicle pending"} • ${detail.branch?.name ?? "No branch"}`}
					actions={
						<>
							<Badge
								variant="outline"
								className={rentalStatusBadgeClass(detail.rental.status)}
							>
								{detail.rental.status.replaceAll("_", " ")}
							</Badge>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setIsEditOpen(true)
								}}
								disabled={!detail.actionState.canEditBooking}
							>
								Edit booking
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									void handleFinalize()
								}}
								disabled={!detail.actionState.canFinalize}
							>
								Finalize
							</Button>
							<Button
								type="button"
								onClick={() => {
									void handleHandover()
								}}
								disabled={!detail.actionState.canHandover}
							>
								Handover
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setActiveTab("operations")
								}}
								disabled={!detail.actionState.canExtend}
							>
								Extend
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setActiveTab("operations")
								}}
								disabled={!detail.actionState.canInitiateReturn}
							>
								Initiate return
							</Button>
						</>
					}
				/>

				<div className="mt-4 grid gap-3 md:grid-cols-4">
					<SummaryStat
						label="Balance Due"
						value={formatCurrency(
							detail.financials.balanceDue,
							detail.rental.currency,
						)}
						subtitle="Schedules + extra charges less deposit applied"
					/>
					<SummaryStat
						label="Deposit Held"
						value={formatCurrency(
							detail.financials.depositHeld,
							detail.rental.currency,
						)}
						subtitle={`Required ${formatCurrency(detail.deposit.amount, detail.rental.currency)}`}
					/>
					<SummaryStat
						label="Planned Window"
						value={formatDateTime(detail.rental.plannedStartAt)}
						subtitle={formatDateTime(detail.rental.plannedEndAt)}
					/>
					<SummaryStat
						label="Actual Window"
						value={formatDateTime(detail.rental.actualStartAt)}
						subtitle={formatDateTime(detail.rental.actualEndAt)}
					/>
				</div>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-4"
			>
				<TabsList className="h-auto flex-wrap justify-start">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="billing">Billing</TabsTrigger>
					<TabsTrigger value="operations">Operations</TabsTrigger>
					<TabsTrigger value="live">Live</TabsTrigger>
					<TabsTrigger value="timeline">Timeline</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-4">
					<div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
						<Card>
							<CardHeader>
								<CardTitle>Booking summary</CardTitle>
								<CardDescription>
									Current booking, agreement, and payment-plan state.
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-4 md:grid-cols-2">
								<div className="rounded-lg border p-4">
									<p className="text-muted-foreground text-xs">Customer</p>
									<p className="mt-1 font-medium">
										{detail.customer?.fullName ?? "Not set"}
									</p>
									<p className="text-muted-foreground mt-1 text-xs">
										{detail.customer?.email ?? detail.customer?.phone ?? "-"}
									</p>
								</div>
								<div className="rounded-lg border p-4">
									<p className="text-muted-foreground text-xs">Vehicle</p>
									<p className="mt-1 font-medium">
										{detail.vehicle?.label ?? "Not set"}
									</p>
									<p className="text-muted-foreground mt-1 text-xs">
										{detail.vehicle?.licensePlate ?? "-"}
									</p>
									{detail.vehicle ? (
										<Link
											href={routes.app.vehicleDetails(detail.vehicle.id)}
											className="mt-2 inline-block text-xs underline"
										>
											Open vehicle
										</Link>
									) : null}
								</div>
								<div className="rounded-lg border p-4">
									<p className="text-muted-foreground text-xs">Agreement</p>
									<p className="mt-1 font-medium">
										{detail.agreement?.signedAt
											? `Signed ${formatDateTime(detail.agreement.signedAt)}`
											: "Pending agreement"}
									</p>
								</div>
								<div className="rounded-lg border p-4">
									<p className="text-muted-foreground text-xs">Plan</p>
									<p className="mt-1 font-medium capitalize">
										{detail.rental.paymentPlanKind}
									</p>
									<p className="text-muted-foreground mt-1 text-xs capitalize">
										{detail.rental.firstCollectionTiming.replaceAll("_", " ")}
										{detail.rental.selectedPaymentMethodType
											? ` • ${detail.rental.selectedPaymentMethodType.replaceAll("_", " ")}`
											: ""}
									</p>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Operational state</CardTitle>
								<CardDescription>
									Readiness flags for the next rental actions.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="rounded-lg border p-4">
									<p className="text-sm font-medium">
										Pickup inspection{" "}
										{detail.actionState.missingPickupInspection
											? "missing"
											: "recorded"}
									</p>
									<p className="text-muted-foreground mt-1 text-xs">
										Handover is enabled once pickup inspection is saved.
									</p>
								</div>
								<div className="rounded-lg border p-4">
									<p className="text-sm font-medium">
										{detail.extraCharges.length} extra charges
									</p>
									<p className="text-muted-foreground mt-1 text-xs">
										{detail.actionState.hasOpenExtraCharges
											? "There are open post-booking charges."
											: "No open post-booking charges."}
									</p>
								</div>
								<div className="rounded-lg border p-4">
									<p className="text-sm font-medium">
										{detail.inspections.length} inspections,{" "}
										{detail.damages.length} damages
									</p>
									<p className="text-muted-foreground mt-1 text-xs">
										Track pickup and return condition evidence here.
									</p>
								</div>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Pricing snapshot</CardTitle>
						</CardHeader>
						<CardContent>
							{detail.pricingSnapshot ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Line item</TableHead>
											<TableHead>Type</TableHead>
											<TableHead className="text-right">Amount</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{detail.pricingSnapshot.lineItems.map((item) => (
											<TableRow key={`${item.code}-${item.label}`}>
												<TableCell>{item.label}</TableCell>
												<TableCell className="capitalize">
													{item.type}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(item.amount, detail.rental.currency)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : (
								<SectionEmpty message="No pricing snapshot available yet." />
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="billing" className="space-y-4">
					<div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
						<Card>
							<CardHeader>
								<CardTitle>Billing actions</CardTitle>
								<CardDescription>
									Prepare schedule collection, cash settlement, and direct
									debit.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid gap-2 md:grid-cols-3">
									<Button
										type="button"
										variant={
											paymentMethodType === "cash" ? "default" : "outline"
										}
										onClick={() => {
											setPaymentMethodType("cash")
										}}
									>
										Cash
									</Button>
									<Button
										type="button"
										variant={
											paymentMethodType === "card" ? "default" : "outline"
										}
										onClick={() => {
											setPaymentMethodType("card")
										}}
									>
										Card / terminal
									</Button>
									<Button
										type="button"
										variant={
											paymentMethodType === "au_becs_debit"
												? "default"
												: "outline"
										}
										onClick={() => {
											setPaymentMethodType("au_becs_debit")
										}}
									>
										Direct debit
									</Button>
								</div>

								<select
									className="h-11 rounded-md border px-3"
									value={selectedScheduleId}
									onChange={(event) => {
										setSelectedScheduleId(event.target.value)
									}}
								>
									<option value="">Select schedule</option>
									{detail.paymentSchedule.map((row) => (
										<option key={row.id} value={row.id}>
											{row.label} • {formatCurrency(row.amount, row.currency)} •{" "}
											{row.status}
										</option>
									))}
								</select>

								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										onClick={() => {
											void handlePreparePayment()
										}}
										disabled={
											!canManagePayments || preparePaymentMutation.isPending
										}
									>
										{preparePaymentMutation.isPending
											? "Preparing..."
											: "Prepare payment"}
									</Button>
									{paymentMethodType === "cash" ? (
										<>
											<Input
												value={amountTendered}
												onChange={(event) => {
													setAmountTendered(event.target.value)
												}}
												className="max-w-[220px]"
												placeholder="Amount tendered"
											/>
											<Button
												type="button"
												variant="outline"
												onClick={() => {
													void handleCollectCash()
												}}
												disabled={
													!canManagePayments || collectCashMutation.isPending
												}
											>
												Collect cash
											</Button>
										</>
									) : null}
								</div>

								{paymentMethodType === "card" ? (
									<RentalPaymentTerminalPanel
										rentalId={rentalId}
										payments={detail.payments}
									/>
								) : null}

								{paymentSession?.paymentMethodType === "au_becs_debit" &&
								detail.customer ? (
									<RentalPaymentAuBecsForm
										rentalId={rentalId}
										paymentSession={paymentSession}
										customerName={detail.customer.fullName}
										customerEmail={detail.customer.email ?? ""}
										onConfirmed={() => {
											void rentalDetailQuery.refetch()
										}}
									/>
								) : null}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Deposit ledger</CardTitle>
								<CardDescription>
									Release, retain, refund, or apply deposit against charges.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid gap-2 md:grid-cols-4">
									<Button
										type="button"
										variant={
											depositAction === "release" ? "default" : "outline"
										}
										onClick={() => {
											setDepositAction("release")
										}}
									>
										Release
									</Button>
									<Button
										type="button"
										variant={depositAction === "refund" ? "default" : "outline"}
										onClick={() => {
											setDepositAction("refund")
										}}
									>
										Refund
									</Button>
									<Button
										type="button"
										variant={depositAction === "retain" ? "default" : "outline"}
										onClick={() => {
											setDepositAction("retain")
										}}
									>
										Retain
									</Button>
									<Button
										type="button"
										variant={
											depositAction === "apply_to_charge"
												? "default"
												: "outline"
										}
										onClick={() => {
											setDepositAction("apply_to_charge")
										}}
									>
										Apply to charge
									</Button>
								</div>
								<div className="grid gap-3 md:grid-cols-2">
									<Input
										value={depositAmount}
										onChange={(event) => {
											setDepositAmount(event.target.value)
										}}
										placeholder="Amount"
									/>
									{depositAction === "apply_to_charge" ? (
										<select
											className="h-11 rounded-md border px-3"
											value={depositChargeId}
											onChange={(event) => {
												setDepositChargeId(event.target.value)
											}}
										>
											<option value="">Select charge</option>
											{openCharges.map((charge) => (
												<option key={charge.id} value={charge.id}>
													{charge.kind} •{" "}
													{formatCurrency(charge.total, charge.currency)}
												</option>
											))}
										</select>
									) : null}
								</div>
								<Textarea
									value={depositNote}
									onChange={(event) => {
										setDepositNote(event.target.value)
									}}
									placeholder="Internal note"
								/>
								<Button
									type="button"
									onClick={() => {
										void handleResolveDeposit()
									}}
									disabled={
										!canManagePayments || resolveDepositMutation.isPending
									}
								>
									{resolveDepositMutation.isPending
										? "Saving..."
										: "Update deposit"}
								</Button>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Type</TableHead>
											<TableHead>Note</TableHead>
											<TableHead className="text-right">Amount</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{detail.deposit.events.length === 0 ? (
											<TableRow>
												<TableCell colSpan={3}>
													No deposit actions recorded yet.
												</TableCell>
											</TableRow>
										) : (
											detail.deposit.events.map((event) => (
												<TableRow key={event.id}>
													<TableCell>
														{event.type.replaceAll("_", " ")}
													</TableCell>
													<TableCell>{event.note ?? "-"}</TableCell>
													<TableCell className="text-right">
														{formatCurrency(event.amount, event.currency)}
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Schedule and payments</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Schedule</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Due</TableHead>
										<TableHead className="text-right">Amount</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{detail.paymentSchedule.map((row) => (
										<TableRow key={row.id}>
											<TableCell>{row.label}</TableCell>
											<TableCell>{row.status.replaceAll("_", " ")}</TableCell>
											<TableCell>{formatDateTime(row.dueAt)}</TableCell>
											<TableCell className="text-right">
												{formatCurrency(row.amount, row.currency)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>

							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Payment</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Method</TableHead>
										<TableHead className="text-right">Amount</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{detail.payments.length === 0 ? (
										<TableRow>
											<TableCell colSpan={4}>
												No payments recorded yet.
											</TableCell>
										</TableRow>
									) : (
										detail.payments.map((payment) => (
											<TableRow key={payment.id}>
												<TableCell>
													<div className="space-y-1">
														<p className="font-medium">
															{payment.id.slice(0, 8)}
														</p>
														<p className="text-muted-foreground text-xs">
															{payment.kind.replaceAll("_", " ")}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className={paymentStatusBadgeClass(payment.status)}
													>
														{payment.status.replaceAll("_", " ")}
													</Badge>
												</TableCell>
												<TableCell>
													{payment.paymentMethodType ?? "-"} /{" "}
													{payment.collectionSurface ?? "-"}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(payment.amount, payment.currency)}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Extra charges</CardTitle>
							<CardDescription>
								Add damages, fines, tolls, fuel, cleaning, and late-return
								charges.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-3 md:grid-cols-4">
								<select
									className="h-11 rounded-md border px-3"
									value={newChargeKind}
									onChange={(event) => {
										setNewChargeKind(event.target.value as RentalChargeKind)
									}}
								>
									<option value="damage">Damage</option>
									<option value="fine">Fine</option>
									<option value="toll">Toll</option>
									<option value="fuel">Fuel</option>
									<option value="cleaning">Cleaning</option>
									<option value="late_return">Late return</option>
									<option value="other">Other</option>
								</select>
								<Input
									value={newChargeAmount}
									onChange={(event) => {
										setNewChargeAmount(event.target.value)
									}}
									placeholder="Base amount"
								/>
								<Input
									value={newChargeTaxAmount}
									onChange={(event) => {
										setNewChargeTaxAmount(event.target.value)
									}}
									placeholder="Tax amount"
								/>
								<Button
									type="button"
									onClick={() => {
										void handleCreateCharge()
									}}
									disabled={
										!canManagePayments || createChargeMutation.isPending
									}
								>
									{createChargeMutation.isPending ? "Adding..." : "Add charge"}
								</Button>
							</div>
							<Textarea
								value={newChargeDescription}
								onChange={(event) => {
									setNewChargeDescription(event.target.value)
								}}
								placeholder="Charge description"
							/>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Charge</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Due</TableHead>
										<TableHead className="text-right">Total</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{detail.extraCharges.length === 0 ? (
										<TableRow>
											<TableCell colSpan={5}>No extra charges yet.</TableCell>
										</TableRow>
									) : (
										detail.extraCharges.map((charge) => (
											<TableRow key={charge.id}>
												<TableCell>
													<div className="space-y-1">
														<p className="font-medium capitalize">
															{charge.kind}
														</p>
														<p className="text-muted-foreground text-xs">
															{charge.description ?? "-"}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className={chargeStatusBadgeClass(charge.status)}
													>
														{charge.status.replaceAll("_", " ")}
													</Badge>
												</TableCell>
												<TableCell>{formatDateTime(charge.dueAt)}</TableCell>
												<TableCell className="text-right">
													{formatCurrency(charge.total, charge.currency)}
												</TableCell>
												<TableCell className="text-right">
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => {
															void handleCollectCharge(charge.id)
														}}
														disabled={
															!canManagePayments ||
															charge.status === "paid" ||
															charge.status === "cancelled"
														}
													>
														Collect
													</Button>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="operations" className="space-y-4">
					<div className="grid gap-4 xl:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Pickup workflow</CardTitle>
								<CardDescription>
									Capture handover condition before activation.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="grid gap-3 md:grid-cols-2">
									<Input
										value={pickupOdometer}
										onChange={(event) => {
											setPickupOdometer(event.target.value)
										}}
										placeholder="Odometer km"
									/>
									<Input
										value={pickupFuelPercent}
										onChange={(event) => {
											setPickupFuelPercent(event.target.value)
										}}
										placeholder="Fuel %"
									/>
								</div>
								<Textarea
									value={pickupNotes}
									onChange={(event) => {
										setPickupNotes(event.target.value)
									}}
									placeholder="Pickup notes"
								/>
								<div className="grid gap-3 md:grid-cols-3">
									<select
										className="h-11 rounded-md border px-3"
										value={pickupDamageCategory}
										onChange={(event) => {
											setPickupDamageCategory(
												event.target.value as RentalDamageCategory,
											)
										}}
									>
										<option value="exterior">Exterior damage</option>
										<option value="interior">Interior damage</option>
										<option value="mechanical">Mechanical issue</option>
										<option value="other">Other</option>
									</select>
									<select
										className="h-11 rounded-md border px-3"
										value={pickupDamageSeverity}
										onChange={(event) => {
											setPickupDamageSeverity(
												event.target.value as RentalDamageSeverity,
											)
										}}
									>
										<option value="minor">Minor</option>
										<option value="moderate">Moderate</option>
										<option value="severe">Severe</option>
									</select>
									<Input
										value={pickupDamageTitle}
										onChange={(event) => {
											setPickupDamageTitle(event.target.value)
										}}
										placeholder="Optional damage note"
									/>
								</div>
								<Button
									type="button"
									onClick={() => {
										void handleSaveInspection("pickup")
									}}
									disabled={inspectionMutation.isPending}
								>
									Save pickup inspection
								</Button>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Extend rental</CardTitle>
								<CardDescription>
									Update the planned end date and create an extension charge
									delta.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<Input
									type="datetime-local"
									value={extensionDate}
									onChange={(event) => {
										setExtensionDate(event.target.value)
									}}
								/>
								<Textarea
									value={extensionReason}
									onChange={(event) => {
										setExtensionReason(event.target.value)
									}}
									placeholder="Reason for extension"
								/>
								<Button
									type="button"
									onClick={() => {
										void handleExtend()
									}}
									disabled={
										!detail.actionState.canExtend || extendMutation.isPending
									}
								>
									{extendMutation.isPending ? "Extending..." : "Extend rental"}
								</Button>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 xl:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Return inspection</CardTitle>
								<CardDescription>
									Capture condition, odometer, fuel, and any return damages.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="grid gap-3 md:grid-cols-2">
									<Input
										value={returnOdometer}
										onChange={(event) => {
											setReturnOdometer(event.target.value)
										}}
										placeholder="Odometer km"
									/>
									<Input
										value={returnFuelPercent}
										onChange={(event) => {
											setReturnFuelPercent(event.target.value)
										}}
										placeholder="Fuel %"
									/>
								</div>
								<Textarea
									value={returnNotes}
									onChange={(event) => {
										setReturnNotes(event.target.value)
									}}
									placeholder="Return notes"
								/>
								<div className="grid gap-3 md:grid-cols-3">
									<select
										className="h-11 rounded-md border px-3"
										value={returnDamageCategory}
										onChange={(event) => {
											setReturnDamageCategory(
												event.target.value as RentalDamageCategory,
											)
										}}
									>
										<option value="exterior">Exterior damage</option>
										<option value="interior">Interior damage</option>
										<option value="mechanical">Mechanical issue</option>
										<option value="other">Other</option>
									</select>
									<select
										className="h-11 rounded-md border px-3"
										value={returnDamageSeverity}
										onChange={(event) => {
											setReturnDamageSeverity(
												event.target.value as RentalDamageSeverity,
											)
										}}
									>
										<option value="minor">Minor</option>
										<option value="moderate">Moderate</option>
										<option value="severe">Severe</option>
									</select>
									<Input
										value={returnDamageTitle}
										onChange={(event) => {
											setReturnDamageTitle(event.target.value)
										}}
										placeholder="Optional damage note"
									/>
								</div>
								<Button
									type="button"
									onClick={() => {
										void handleSaveInspection("return")
									}}
									disabled={inspectionMutation.isPending}
								>
									Save return inspection
								</Button>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Close rental</CardTitle>
								<CardDescription>
									Finalize return after inspections, charges, and deposit
									resolution.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<Textarea
									value={returnCloseNotes}
									onChange={(event) => {
										setReturnCloseNotes(event.target.value)
									}}
									placeholder="Completion notes"
								/>
								<Button
									type="button"
									onClick={() => {
										void handleReturn()
									}}
									disabled={
										!detail.actionState.canCloseRental ||
										returnMutation.isPending
									}
								>
									{returnMutation.isPending ? "Closing..." : "Close rental"}
								</Button>
								<div className="rounded-lg border p-4 text-sm">
									<p className="font-medium">Finalize agreement</p>
									<p className="text-muted-foreground mt-1 text-xs">
										If the rental is still draft/awaiting payment, finalize
										here.
									</p>
									<div className="mt-3 grid gap-3">
										<Input
											value={signerName}
											onChange={(event) => {
												setSignerName(event.target.value)
											}}
											placeholder="Signer name"
										/>
										<Textarea
											value={signature}
											onChange={(event) => {
												setSignature(event.target.value)
											}}
											placeholder="Signature payload"
										/>
										<Button
											type="button"
											variant="outline"
											onClick={() => {
												void handleFinalize()
											}}
											disabled={
												!detail.actionState.canFinalize ||
												finalizeMutation.isPending
											}
										>
											{finalizeMutation.isPending
												? "Finalizing..."
												: "Finalize rental"}
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="live">
					{canViewLive && detail.vehicle ? (
						<VehicleLiveLocationTab
							vehicleId={detail.vehicle.id}
							organizationId={organizationId}
						/>
					) : (
						<Card>
							<CardContent>
								<SectionEmpty message="Live telemetry is only available to privileged fleet users with vehicle access." />
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="timeline">
					<Card>
						<CardHeader>
							<CardTitle>Rental timeline</CardTitle>
							<CardDescription>
								Audit trail for booking, inspection, billing, deposit, and
								return actions.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Event</TableHead>
										<TableHead>When</TableHead>
										<TableHead>Payload</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{detail.timeline.length === 0 ? (
										<TableRow>
											<TableCell colSpan={3}>
												No timeline entries yet.
											</TableCell>
										</TableRow>
									) : (
										detail.timeline.map((entry) => (
											<TableRow key={entry.id}>
												<TableCell>{entry.type}</TableCell>
												<TableCell>{formatDateTime(entry.createdAt)}</TableCell>
												<TableCell className="font-mono text-xs">
													<pre className="whitespace-pre-wrap">
														{JSON.stringify(entry.payload, null, 2)}
													</pre>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<RentalAppointmentDrawer
				open={isEditOpen}
				onOpenChange={setIsEditOpen}
				existingRentalId={rentalId}
				onRentalFinalized={() => {
					void rentalDetailQuery.refetch()
				}}
			/>
		</PageContentShell>
	)
}
