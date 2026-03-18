"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { PageContentShell } from "@/components/ui/page-content-shell"
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
import { Textarea } from "@/components/ui/textarea"
import { routes } from "@/config/routes"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import {
	type RentalChargeKind,
	type RentalChargeSummary,
	useCollectCashPaymentMutation,
	useCollectRentalChargeMutation,
	useCreateRentalChargeMutation,
	useExtendRentalMutation,
	useFinalizeRentalMutation,
	usePrepareRentalPaymentMutation,
	useRentalDraftQuery,
	useResolveRentalDepositMutation,
} from "@/features/rentals"
import {
	getRentalAttentionMessages,
	getRentalPlanLabel,
	getRentalPrimaryAction,
	getRentalStatusLabel,
} from "@/features/rentals/lib/ui-state"
import { resolveErrorMessage } from "@/lib/errors"
import { isPrivilegedFleetRole } from "@/lib/fleet/live"
import { RentalAppointmentDrawer } from "./rental-appointment-drawer"
import { RentalHandoverDrawer } from "./rental-handover-drawer"
import { RentalPaymentAuBecsForm } from "./rental-payment-au-becs-form"
import { RentalPaymentTerminalPanel } from "./rental-payment-terminal-panel"
import { RentalReturnDrawer } from "./rental-return-drawer"

type RentalDetailsProps = {
	rentalId: string
}

type BillingPanel = "collect" | "deposit" | "charges" | "history"
type OperationsPanel = "handover" | "extend" | "return"

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
		<div className="rounded-2xl border bg-background px-4 py-4 shadow-xs">
			<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
				{label}
			</p>
			<p className="mt-3 text-2xl font-semibold">{value}</p>
			{subtitle ? (
				<p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
			) : null}
		</div>
	)
}

function SectionEmpty({ message }: { message: string }) {
	return <p className="text-muted-foreground text-sm">{message}</p>
}

function DetailPair({
	label,
	value,
	hint,
}: {
	label: string
	value: string
	hint?: string
}) {
	return (
		<div className="rounded-2xl border bg-muted/20 p-4">
			<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
				{label}
			</p>
			<p className="mt-2 text-sm font-medium">{value}</p>
			{hint ? (
				<p className="text-muted-foreground mt-1 text-sm">{hint}</p>
			) : null}
		</div>
	)
}

function formatConditionRatingLabel(value: string | null) {
	if (!value) {
		return "Not recorded"
	}

	return value.replaceAll("_", " ")
}

function formatInspectionMetricDelta(
	pickupValue: number | null,
	returnValue: number | null,
	unit: string,
) {
	if (pickupValue == null && returnValue == null) {
		return {
			value: "Not recorded",
			hint: "No pickup or return value is available yet.",
		}
	}

	if (pickupValue == null || returnValue == null) {
		return {
			value: `${pickupValue ?? returnValue} ${unit}`,
			hint: "Both pickup and return values are needed to show the delta.",
		}
	}

	const delta = Number((returnValue - pickupValue).toFixed(2))
	const deltaLabel =
		delta === 0 ? `No change` : `${delta > 0 ? "+" : ""}${delta} ${unit}`

	return {
		value: `${returnValue} ${unit}`,
		hint: `Pickup ${pickupValue} ${unit} -> Return ${returnValue} ${unit} (${deltaLabel})`,
	}
}

function formatInspectionTextDelta(
	label: string,
	pickupValue: string | null,
	returnValue: string | null,
) {
	if (!pickupValue && !returnValue) {
		return {
			value: "Not recorded",
			hint: `No ${label.toLowerCase()} value is available yet.`,
		}
	}

	if (!pickupValue || !returnValue) {
		return {
			value: returnValue ?? pickupValue ?? "Not recorded",
			hint: `Both pickup and return ${label.toLowerCase()} values are needed to show change.`,
		}
	}

	return {
		value: returnValue,
		hint:
			pickupValue === returnValue
				? `No change from pickup (${pickupValue}).`
				: `Pickup ${pickupValue} -> Return ${returnValue}`,
	}
}

function PanelToggle({
	value,
	activeValue,
	onClick,
}: {
	value: string
	activeValue: string
	onClick: () => void
}) {
	return (
		<Button
			type="button"
			variant={value === activeValue ? "default" : "outline"}
			onClick={onClick}
		>
			{value}
		</Button>
	)
}

function formatTimelineLabel(type: string) {
	return type
		.split(".")
		.map((segment) => segment.replaceAll("_", " "))
		.join(" / ")
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
	const extendMutation = useExtendRentalMutation(organizationId)
	const createChargeMutation = useCreateRentalChargeMutation(organizationId)
	const collectChargeMutation = useCollectRentalChargeMutation(organizationId)
	const resolveDepositMutation = useResolveRentalDepositMutation(organizationId)

	const detail = rentalDetailQuery.data
	const [activeTab, setActiveTab] = useState("overview")
	const [activeBillingPanel, setActiveBillingPanel] =
		useState<BillingPanel>("collect")
	const [activeOperationsPanel, setActiveOperationsPanel] =
		useState<OperationsPanel>("handover")
	const [isEditOpen, setIsEditOpen] = useState(false)
	const [isFinalizeOpen, setIsFinalizeOpen] = useState(false)
	const [isHandoverOpen, setIsHandoverOpen] = useState(false)
	const [isReturnFlowOpen, setIsReturnFlowOpen] = useState(false)
	const [selectedScheduleId, setSelectedScheduleId] = useState<string>("")
	const [paymentMethodType, setPaymentMethodType] = useState<
		"cash" | "card" | "au_becs_debit"
	>("cash")
	const [scheduleAmountTendered, setScheduleAmountTendered] = useState("")
	const [chargeToCollect, setChargeToCollect] =
		useState<RentalChargeSummary | null>(null)
	const [chargeCollectionMethod, setChargeCollectionMethod] = useState<
		"cash" | "card"
	>("cash")
	const [chargeAmountTendered, setChargeAmountTendered] = useState("")
	const [paymentSession, setPaymentSession] = useState<{
		mode: "payment" | "setup"
		clientSecret: string
		intentId: string
		paymentMethodType: "card" | "au_becs_debit"
		collectionSurface: "terminal_reader" | "direct_debit"
	} | null>(null)
	const [signerName, setSignerName] = useState("")
	const [signature, setSignature] = useState("")
	const [extensionDate, setExtensionDate] = useState("")
	const [extensionReason, setExtensionReason] = useState("")
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
		setActiveOperationsPanel(
			detail.rental.status === "active" ? "return" : "handover",
		)
	}, [detail])

	const primaryAction = detail ? getRentalPrimaryAction(detail) : null
	const attentionMessages = detail ? getRentalAttentionMessages(detail) : []
	const openCharges =
		detail?.extraCharges.filter(
			(row) => row.status === "open" || row.status === "partially_paid",
		) ?? []
	const pickupInspection =
		detail?.inspections.find((inspection) => inspection.stage === "pickup") ??
		null
	const returnInspection =
		detail?.inspections.find((inspection) => inspection.stage === "return") ??
		null

	const paymentSummary = useMemo(() => {
		if (!detail) {
			return {
				completedPayments: 0,
				pendingSchedules: 0,
			}
		}

		return {
			completedPayments: detail.payments.filter(
				(payment) => payment.status === "succeeded",
			).length,
			pendingSchedules: detail.paymentSchedule.filter(
				(schedule) => schedule.status !== "succeeded",
			).length,
		}
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

		if (!scheduleAmountTendered.trim() || Number(scheduleAmountTendered) <= 0) {
			toast.error("Enter the cash amount received for this payment.")
			return
		}

		try {
			await collectCashMutation.mutateAsync({
				rentalId,
				payload: {
					scheduleId: selectedScheduleId,
					amountTendered: Number(scheduleAmountTendered),
				},
			})
			setScheduleAmountTendered("")
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
			setIsFinalizeOpen(false)
			toast.success("Rental finalized.")
			void rentalDetailQuery.refetch()
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to finalize rental."))
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

	async function handleCollectCharge() {
		if (!chargeToCollect) {
			return
		}

		if (
			chargeCollectionMethod === "cash" &&
			(!chargeAmountTendered.trim() || Number(chargeAmountTendered) <= 0)
		) {
			toast.error("Enter the cash amount received for this charge.")
			return
		}

		try {
			await collectChargeMutation.mutateAsync({
				rentalId,
				chargeId: chargeToCollect.id,
				payload: {
					paymentMethodType: chargeCollectionMethod,
					amountTendered:
						chargeCollectionMethod === "cash"
							? Number(chargeAmountTendered)
							: undefined,
				},
			})
			setChargeToCollect(null)
			setChargeAmountTendered("")
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

	function handlePrimaryActionClick() {
		if (!primaryAction || primaryAction.type === "none") {
			return
		}

		if (primaryAction.type === "finalize") {
			setIsFinalizeOpen(true)
			return
		}

		if (primaryAction.type === "handover") {
			setIsHandoverOpen(true)
			return
		}

		setActiveTab("operations")
		setActiveOperationsPanel("return")
		setIsReturnFlowOpen(true)
	}

	if (rentalDetailQuery.isPending) {
		return (
			<PageContentShell>
				<Card>
					<CardHeader>
						<CardTitle>Rental details</CardTitle>
						<CardDescription>
							Loading the rental workflow and payment summary...
						</CardDescription>
					</CardHeader>
				</Card>
			</PageContentShell>
		)
	}

	if (!detail || rentalDetailQuery.isError) {
		return (
			<PageContentShell>
				<Card>
					<CardHeader>
						<CardTitle>Rental details</CardTitle>
						<CardDescription>
							We could not load this rental right now.
						</CardDescription>
					</CardHeader>
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

	return (
		<PageContentShell className="space-y-5 pb-8">
			<div className="sticky top-4 z-20 rounded-3xl border bg-background/95 p-5 shadow-sm backdrop-blur">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
								Rental workflow
							</p>
							<Badge
								variant="outline"
								className={rentalStatusBadgeClass(detail.rental.status)}
							>
								{getRentalStatusLabel(detail.rental.status)}
							</Badge>
							<Badge variant="outline">
								{getRentalPlanLabel(detail.rental.paymentPlanKind)}
							</Badge>
						</div>
						<div>
							<h1 className="text-2xl font-semibold tracking-tight">
								Rental {detail.rental.id.slice(0, 8)}
							</h1>
							<p className="text-muted-foreground mt-1 text-sm sm:text-base">
								{detail.customer?.fullName ?? "Customer pending"} •{" "}
								{detail.vehicle?.label ?? "Vehicle pending"} •{" "}
								{detail.branch?.name ?? "No branch"}
							</p>
						</div>
						<p className="max-w-3xl text-sm font-medium sm:text-base">
							{primaryAction?.description}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type="button" variant="outline" size="icon-sm">
									<span className="sr-only">Open rental actions</span>
									...
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuLabel>Rental actions</DropdownMenuLabel>
								<DropdownMenuItem
									onSelect={() => {
										setIsEditOpen(true)
									}}
									disabled={!detail.actionState.canEditBooking}
								>
									Edit booking
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => {
										setActiveTab("billing")
									}}
								>
									Open billing
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => {
										setActiveTab("operations")
									}}
								>
									Open operations
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => {
										setActiveTab("timeline")
									}}
								>
									Open timeline
								</DropdownMenuItem>
								{canViewLive && detail.vehicle ? (
									<DropdownMenuItem
										onSelect={() => {
											setActiveTab("live")
										}}
									>
										Open live view
									</DropdownMenuItem>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>

						{primaryAction?.label ? (
							<Button
								type="button"
								onClick={handlePrimaryActionClick}
								disabled={primaryAction.disabled}
							>
								{primaryAction.label}
							</Button>
						) : null}
					</div>
				</div>
			</div>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<SummaryStat
					label="Balance due"
					value={formatCurrency(
						detail.financials.balanceDue,
						detail.rental.currency,
					)}
					subtitle="This includes unpaid schedule items and open extra charges."
				/>
				<SummaryStat
					label="Deposit held"
					value={formatCurrency(
						detail.financials.depositHeld,
						detail.rental.currency,
					)}
					subtitle={`Required deposit ${formatCurrency(detail.deposit.amount, detail.rental.currency)}`}
				/>
				<SummaryStat
					label="Planned window"
					value={formatDateTime(detail.rental.plannedStartAt)}
					subtitle={formatDateTime(detail.rental.plannedEndAt)}
				/>
				<SummaryStat
					label="Actual window"
					value={formatDateTime(detail.rental.actualStartAt)}
					subtitle={formatDateTime(detail.rental.actualEndAt)}
				/>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>What needs attention</CardTitle>
					<CardDescription>
						These short notes explain the current state in plain language.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3 md:grid-cols-2">
					{attentionMessages.map((message) => (
						<div key={message} className="rounded-2xl border bg-muted/20 p-4">
							<p className="text-sm font-medium">{message}</p>
						</div>
					))}
				</CardContent>
			</Card>

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
					<div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
						<Card>
							<CardHeader>
								<CardTitle>Next step</CardTitle>
								<CardDescription>
									This is the clearest path forward for the team right now.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="rounded-2xl border bg-muted/20 p-4">
									<p className="text-sm font-medium">
										{primaryAction?.description}
									</p>
									<p className="text-muted-foreground mt-1 text-sm">
										Use the main action button when you are ready, or open the
										relevant tab to review more details first.
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setActiveTab("billing")
										}}
									>
										Review billing
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setActiveTab("operations")
										}}
									>
										Review operations
									</Button>
								</div>
								<div className="grid gap-3 md:grid-cols-2">
									<DetailPair
										label="Agreement"
										value={
											detail.agreement?.signedAt
												? `Signed ${formatDateTime(detail.agreement.signedAt)}`
												: "Agreement still needs final confirmation."
										}
										hint="Finalize the rental when agreement details are ready."
									/>
									<DetailPair
										label="Next payment moment"
										value={
											detail.paymentSchedule[0]
												? `${detail.paymentSchedule[0].label} • ${formatDateTime(detail.paymentSchedule[0].dueAt)}`
												: "No payment schedule yet."
										}
										hint="Use the billing tab to collect or prepare payment."
									/>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Booking summary</CardTitle>
								<CardDescription>
									Core timing, branch, and plan details in one quick view.
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-3">
								<DetailPair
									label="Branch"
									value={detail.branch?.name ?? "No branch selected"}
								/>
								<DetailPair
									label="Plan"
									value={getRentalPlanLabel(detail.rental.paymentPlanKind)}
									hint={`First collection ${detail.rental.firstCollectionTiming.replaceAll("_", " ")}${detail.rental.selectedPaymentMethodType ? ` • ${detail.rental.selectedPaymentMethodType.replaceAll("_", " ")}` : ""}`}
								/>
								<DetailPair
									label="Created"
									value={formatDateTime(detail.rental.createdAt)}
									hint={`Updated ${formatDateTime(detail.rental.updatedAt)}`}
								/>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 xl:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Vehicle and customer</CardTitle>
								<CardDescription>
									Use this section when staff need a quick identity check.
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-3 md:grid-cols-2">
								<DetailPair
									label="Customer"
									value={detail.customer?.fullName ?? "Customer not set"}
									hint={detail.customer?.email ?? detail.customer?.phone ?? "-"}
								/>
								<DetailPair
									label="Vehicle"
									value={detail.vehicle?.label ?? "Vehicle not set"}
									hint={detail.vehicle?.licensePlate ?? "-"}
								/>
								{detail.vehicle ? (
									<div className="md:col-span-2">
										<Link
											href={routes.app.vehicleDetails(detail.vehicle.id)}
											className="text-sm font-medium underline underline-offset-4"
										>
											Open vehicle details
										</Link>
									</div>
								) : null}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Payment summary</CardTitle>
								<CardDescription>
									These numbers help staff understand what is already settled
									and what is still open.
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-3 md:grid-cols-2">
								<DetailPair
									label="Completed payments"
									value={String(paymentSummary.completedPayments)}
									hint="Successful payment records linked to this rental."
								/>
								<DetailPair
									label="Pending schedule items"
									value={String(paymentSummary.pendingSchedules)}
									hint="These items still need collection or follow-up."
								/>
								<DetailPair
									label="Extra charges"
									value={String(detail.extraCharges.length)}
									hint={
										detail.actionState.hasOpenExtraCharges
											? "Some extra charges are still open."
											: "No extra charges are waiting right now."
									}
								/>
								<DetailPair
									label="Deposit status"
									value={formatCurrency(
										detail.financials.depositHeld,
										detail.rental.currency,
									)}
									hint="Deposit actions stay in the billing tab."
								/>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 xl:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Condition summary</CardTitle>
								<CardDescription>
									A quick read on inspections and damage follow-up.
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-3 md:grid-cols-2">
								<DetailPair
									label="Handover inspection"
									value={
										detail.actionState.missingPickupInspection
											? "Still missing"
											: "Recorded"
									}
									hint="The handover flow records start-of-rental checks before activation."
								/>
								<DetailPair
									label="Latest vehicle condition"
									value={
										detail.vehicle?.latestConditionSnapshot
											? formatConditionRatingLabel(
													detail.vehicle.latestConditionSnapshot.rating,
												)
											: "Not recorded"
									}
									hint={
										detail.vehicle?.latestConditionSnapshot
											? `Latest baseline from ${detail.vehicle.latestConditionSnapshot.inspectionStage} inspection.`
											: "The latest vehicle baseline updates when a handover condition change is logged or a return inspection is saved."
									}
								/>
								<DetailPair
									label="Condition rating delta"
									value={formatConditionRatingLabel(
										returnInspection?.conditionRating ?? null,
									)}
									hint={
										formatInspectionTextDelta(
											"condition rating",
											pickupInspection?.conditionRating ?? null,
											returnInspection?.conditionRating ?? null,
										).hint
									}
								/>
								<DetailPair
									label="Odometer delta"
									value={
										formatInspectionMetricDelta(
											pickupInspection?.odometerKm ?? null,
											returnInspection?.odometerKm ?? null,
											"km",
										).value
									}
									hint={
										formatInspectionMetricDelta(
											pickupInspection?.odometerKm ?? null,
											returnInspection?.odometerKm ?? null,
											"km",
										).hint
									}
								/>
								<DetailPair
									label="Fuel delta"
									value={
										formatInspectionMetricDelta(
											pickupInspection?.fuelPercent ?? null,
											returnInspection?.fuelPercent ?? null,
											"%",
										).value
									}
									hint={
										formatInspectionMetricDelta(
											pickupInspection?.fuelPercent ?? null,
											returnInspection?.fuelPercent ?? null,
											"%",
										).hint
									}
								/>
								<DetailPair
									label="Cleanliness delta"
									value={
										formatInspectionTextDelta(
											"cleanliness",
											pickupInspection?.cleanliness ?? null,
											returnInspection?.cleanliness ?? null,
										).value
									}
									hint={
										formatInspectionTextDelta(
											"cleanliness",
											pickupInspection?.cleanliness ?? null,
											returnInspection?.cleanliness ?? null,
										).hint
									}
								/>
								<DetailPair
									label="Damage items"
									value={String(detail.damages.length)}
									hint="Damage records help explain follow-up charges and deposit decisions."
								/>
								<DetailPair
									label="Return readiness"
									value={
										detail.actionState.canCloseRental
											? "Rental can be closed when the team is ready."
											: "There is still work to finish before closing."
									}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Pricing snapshot</CardTitle>
								<CardDescription>
									This shows the latest pricing breakdown saved for the rental.
								</CardDescription>
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
														{formatCurrency(
															item.amount,
															detail.rental.currency,
														)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								) : (
									<SectionEmpty message="No pricing snapshot is available yet." />
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="billing" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Billing workflow</CardTitle>
							<CardDescription>
								Open one billing task at a time so the team can stay focused.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-wrap gap-2">
							<PanelToggle
								value="collect"
								activeValue={activeBillingPanel}
								onClick={() => setActiveBillingPanel("collect")}
							/>
							<PanelToggle
								value="deposit"
								activeValue={activeBillingPanel}
								onClick={() => setActiveBillingPanel("deposit")}
							/>
							<PanelToggle
								value="charges"
								activeValue={activeBillingPanel}
								onClick={() => setActiveBillingPanel("charges")}
							/>
							<PanelToggle
								value="history"
								activeValue={activeBillingPanel}
								onClick={() => setActiveBillingPanel("history")}
							/>
						</CardContent>
					</Card>

					{activeBillingPanel === "collect" ? (
						<div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
							<Card>
								<CardHeader>
									<CardTitle>Collect scheduled payment</CardTitle>
									<CardDescription>
										Choose the schedule row and collection method that matches
										the current payment moment.
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
												{row.label} • {formatCurrency(row.amount, row.currency)}{" "}
												• {row.status}
											</option>
										))}
									</select>

									<p className="text-muted-foreground text-sm">
										Prepare the payment first for card or direct debit. Use cash
										collection when money is already in hand.
									</p>

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
													value={scheduleAmountTendered}
													onChange={(event) => {
														setScheduleAmountTendered(event.target.value)
													}}
													className="max-w-60"
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
									<CardTitle>Billing summary</CardTitle>
									<CardDescription>
										Use these numbers to check whether the rental is financially
										ready for the next step.
									</CardDescription>
								</CardHeader>
								<CardContent className="grid gap-3">
									<DetailPair
										label="Invoice total"
										value={formatCurrency(
											detail.financials.invoiceTotal,
											detail.rental.currency,
										)}
									/>
									<DetailPair
										label="Scheduled outstanding"
										value={formatCurrency(
											detail.financials.scheduledOutstanding,
											detail.rental.currency,
										)}
									/>
									<DetailPair
										label="Extra charge balance"
										value={formatCurrency(
											detail.financials.extraChargesOutstanding,
											detail.rental.currency,
										)}
									/>
									<DetailPair
										label="Total paid"
										value={formatCurrency(
											detail.financials.totalPaid,
											detail.rental.currency,
										)}
									/>
								</CardContent>
							</Card>
						</div>
					) : null}

					{activeBillingPanel === "deposit" ? (
						<Card>
							<CardHeader>
								<CardTitle>Deposit workflow</CardTitle>
								<CardDescription>
									Release, refund, retain, or apply the deposit with a clear
									internal note.
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
									placeholder="Explain why this deposit action is being taken"
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
					) : null}

					{activeBillingPanel === "charges" ? (
						<Card>
							<CardHeader>
								<CardTitle>Extra charges</CardTitle>
								<CardDescription>
									Add and collect charges with clear descriptions so the team
									understands why they exist.
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
										{createChargeMutation.isPending
											? "Adding..."
											: "Add charge"}
									</Button>
								</div>
								<Textarea
									value={newChargeDescription}
									onChange={(event) => {
										setNewChargeDescription(event.target.value)
									}}
									placeholder="Write a short explanation for staff and finance records"
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
																setChargeToCollect(charge)
																setChargeCollectionMethod("cash")
																setChargeAmountTendered("")
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
					) : null}

					{activeBillingPanel === "history" ? (
						<Card>
							<CardHeader>
								<CardTitle>Schedule and payment history</CardTitle>
								<CardDescription>
									Read past and upcoming financial activity in one place.
								</CardDescription>
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
					) : null}
				</TabsContent>

				<TabsContent value="operations" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Operations workflow</CardTitle>
							<CardDescription>
								Open only the stage you are working on so the handover and
								return process stays easy to follow.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-wrap gap-2">
							<PanelToggle
								value="handover"
								activeValue={activeOperationsPanel}
								onClick={() => setActiveOperationsPanel("handover")}
							/>
							<PanelToggle
								value="extend"
								activeValue={activeOperationsPanel}
								onClick={() => setActiveOperationsPanel("extend")}
							/>
							<PanelToggle
								value="return"
								activeValue={activeOperationsPanel}
								onClick={() => setActiveOperationsPanel("return")}
							/>
						</CardContent>
					</Card>

					{activeOperationsPanel === "handover" ? (
						<div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
							<Card>
								<CardHeader>
									<CardTitle>Handover inspection</CardTitle>
									<CardDescription>
										The guided handover flow now owns start-of-rental readings,
										optional condition proof, and activation.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="rounded-2xl border bg-muted/20 p-4 text-sm">
										<p className="font-medium">Use the guided handover flow</p>
										<p className="text-muted-foreground mt-1">
											Start-of-rental readings, optional condition proof, and
											the final activation action now live in one full-screen
											flow so staff do not have to save a pickup record
											separately first.
										</p>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<DetailPair
											label="Recorded start inspection"
											value={
												detail.actionState.missingPickupInspection
													? "Still missing"
													: "Recorded"
											}
											hint="The handover drawer will save this record before activation."
										/>
										<DetailPair
											label="Latest vehicle baseline"
											value={
												detail.vehicle?.latestConditionSnapshot
													? formatConditionRatingLabel(
															detail.vehicle.latestConditionSnapshot.rating,
														)
													: "Not recorded"
											}
											hint={
												detail.vehicle?.latestConditionSnapshot
													? `Latest baseline from ${detail.vehicle.latestConditionSnapshot.inspectionStage} inspection.`
													: "The handover flow can record optional proof if the vehicle differs from the latest baseline."
											}
										/>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Handover readiness</CardTitle>
									<CardDescription>
										Make sure the team sees whether handover can happen now and
										which blockers the guided flow still needs to clear.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									<DetailPair
										label="Inspection status"
										value={
											detail.actionState.missingPickupInspection
												? "Will be recorded during handover."
												: "Already recorded."
										}
									/>
									<DetailPair
										label="Payment setup"
										value={
											detail.rental.selectedPaymentMethodType
												? `Method selected: ${detail.rental.selectedPaymentMethodType.replaceAll("_", " ")}`
												: "No payment method selected yet."
										}
									/>
									<Button
										type="button"
										onClick={() => {
											setIsHandoverOpen(true)
										}}
										disabled={!detail.actionState.canHandover}
									>
										Open handover flow
									</Button>
								</CardContent>
							</Card>
						</div>
					) : null}

					{activeOperationsPanel === "extend" ? (
						<Card>
							<CardHeader>
								<CardTitle>Extend rental</CardTitle>
								<CardDescription>
									Update the planned return date and record why the change
									happened.
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
					) : null}

					{activeOperationsPanel === "return" ? (
						<div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
							<Card>
								<CardHeader>
									<CardTitle>Vehicle return flow</CardTitle>
									<CardDescription>
										Use one guided drawer to capture condition photos, add
										damage or extra charges, collect the balance, and finish the
										return.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="grid gap-3 md:grid-cols-2">
										<DetailPair
											label="Inspection"
											value={
												detail.actionState.hasReturnInspection
													? "Return inspection saved."
													: "Return inspection still needs to be captured."
											}
											hint="The drawer now handles return photos, notes, and condition evidence together."
										/>
										<DetailPair
											label="Balance due now"
											value={formatCurrency(
												detail.financials.balanceDue,
												detail.deposit.currency,
											)}
											hint="This includes unpaid schedule balance and open return-time charges."
										/>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<DetailPair
											label="Deposit held"
											value={formatCurrency(
												detail.financials.depositHeld,
												detail.deposit.currency,
											)}
											hint={
												detail.actionState.requiresDepositResolution
													? "A deposit decision is still required before closeout."
													: "No deposit action is blocking the return right now."
											}
										/>
										<DetailPair
											label="Next step"
											value={
												detail.actionState.canCompleteReturn
													? "Review the summary and complete the return."
													: "Open the guided return flow and finish the remaining items."
											}
											hint="The new flow keeps the team focused on one step at a time."
										/>
									</div>
									<Button
										type="button"
										onClick={() => {
											setIsReturnFlowOpen(true)
										}}
									>
										Open return flow
									</Button>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>What still needs attention</CardTitle>
									<CardDescription>
										Keep these blockers simple so staff can understand the next
										move without decoding the system.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									<DetailPair
										label="Return inspection"
										value={
											detail.actionState.hasReturnInspection
												? "Captured"
												: "Still missing"
										}
									/>
									<DetailPair
										label="Scheduled balance"
										value={
											detail.actionState.hasOutstandingScheduledBalance
												? "Still outstanding"
												: "Settled"
										}
									/>
									<DetailPair
										label="Extra charges"
										value={
											detail.actionState.hasOutstandingExtraCharges
												? "Still open"
												: "Settled"
										}
									/>
									<DetailPair
										label="Deposit"
										value={
											detail.actionState.requiresDepositResolution
												? "Needs a final decision"
												: "Resolved"
										}
									/>
									<p className="text-muted-foreground text-sm">
										The return can only be completed after the drawer shows that
										inspection, balance, and deposit are all in a clear final
										state.
									</p>
								</CardContent>
							</Card>
						</div>
					) : null}
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
								<SectionEmpty message="Live telemetry is available only to privileged fleet users who can access this vehicle." />
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="timeline">
					<Card>
						<CardHeader>
							<CardTitle>Rental timeline</CardTitle>
							<CardDescription>
								Read the story of the rental first, then open raw payload
								details only when you need them.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{detail.timeline.length === 0 ? (
								<SectionEmpty message="No timeline entries yet." />
							) : (
								detail.timeline.map((entry) => (
									<div key={entry.id} className="rounded-2xl border p-4">
										<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
											<div>
												<p className="font-medium">
													{formatTimelineLabel(entry.type)}
												</p>
												<p className="text-muted-foreground text-sm">
													{formatDateTime(entry.createdAt)}
												</p>
											</div>
											<p className="text-muted-foreground text-sm">
												Actor {entry.actorMemberId?.slice(0, 8) ?? "system"}
											</p>
										</div>
										<details className="mt-3 rounded-xl border bg-muted/20 p-3">
											<summary className="cursor-pointer text-sm font-medium">
												Show raw details
											</summary>
											<pre className="mt-3 whitespace-pre-wrap text-xs">
												{JSON.stringify(entry.payload, null, 2)}
											</pre>
										</details>
									</div>
								))
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<ResponsiveDrawer
				open={isFinalizeOpen}
				onOpenChange={setIsFinalizeOpen}
				title="Finalize rental"
				description="Add the agreement confirmation details before moving this booking forward."
			>
				<div className="space-y-4">
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
					<p className="text-muted-foreground text-sm">
						This step confirms that the agreement is accepted and the rental is
						ready for its next stage.
					</p>
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsFinalizeOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={() => {
								void handleFinalize()
							}}
							disabled={
								!detail.actionState.canFinalize || finalizeMutation.isPending
							}
						>
							{finalizeMutation.isPending ? "Finalizing..." : "Finalize rental"}
						</Button>
					</div>
				</div>
			</ResponsiveDrawer>

			<RentalHandoverDrawer
				open={isHandoverOpen}
				onOpenChange={setIsHandoverOpen}
				rentalId={rentalId}
				detail={detail}
				onUpdated={async () => {
					await rentalDetailQuery.refetch()
				}}
			/>

			<RentalReturnDrawer
				open={isReturnFlowOpen}
				onOpenChange={setIsReturnFlowOpen}
				rentalId={rentalId}
				detail={detail}
				onUpdated={async () => {
					await rentalDetailQuery.refetch()
				}}
			/>

			<ResponsiveDrawer
				open={chargeToCollect !== null}
				onOpenChange={(open) => {
					if (!open) {
						setChargeToCollect(null)
						setChargeAmountTendered("")
					}
				}}
				title="Collect charge"
				description="Choose how the customer is paying this charge and confirm the amount."
			>
				{chargeToCollect ? (
					<div className="space-y-4">
						<div className="rounded-2xl border bg-muted/20 p-4">
							<p className="text-sm font-medium capitalize">
								{chargeToCollect.kind} charge
							</p>
							<p className="text-muted-foreground mt-1 text-sm">
								{chargeToCollect.description ??
									"No extra description provided."}
							</p>
							<p className="mt-2 text-sm font-medium">
								{formatCurrency(
									chargeToCollect.total,
									chargeToCollect.currency,
								)}
							</p>
						</div>

						<div className="grid gap-2 md:grid-cols-2">
							<Button
								type="button"
								variant={
									chargeCollectionMethod === "cash" ? "default" : "outline"
								}
								onClick={() => {
									setChargeCollectionMethod("cash")
								}}
							>
								Cash
							</Button>
							<Button
								type="button"
								variant={
									chargeCollectionMethod === "card" ? "default" : "outline"
								}
								onClick={() => {
									setChargeCollectionMethod("card")
								}}
							>
								Card
							</Button>
						</div>

						{chargeCollectionMethod === "cash" ? (
							<Input
								value={chargeAmountTendered}
								onChange={(event) => {
									setChargeAmountTendered(event.target.value)
								}}
								placeholder="Amount tendered"
							/>
						) : null}

						<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setChargeToCollect(null)
									setChargeAmountTendered("")
								}}
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={() => {
									void handleCollectCharge()
								}}
								disabled={!canManagePayments || collectChargeMutation.isPending}
							>
								{collectChargeMutation.isPending
									? "Collecting..."
									: "Collect charge"}
							</Button>
						</div>
					</div>
				) : null}
			</ResponsiveDrawer>

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
