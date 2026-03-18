"use client"

import {
	Banknote,
	CalendarRange,
	CheckCircle2,
	CreditCard,
	Landmark,
	LoaderCircle,
	Sparkles,
	WandSparkles,
} from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer"
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { hasCustomerLookupInput } from "@/features/customers/lib/normalize"
import { useCustomerLookupQuery } from "@/features/customers/queries/use-customer-lookup-query"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import {
	buildRentalPaymentSchedulePreview,
	computeRentalQuote,
	defaultInstallmentIntervalForDuration,
	type RentalAlternativeMatchMode,
	type RentalCollectionTiming,
	type RentalCommitPayload,
	type RentalConditionRating,
	type RentalDetailResponse,
	type RentalInstallmentInterval,
	type RentalPaymentMethodType,
	type RentalPaymentPlanKind,
	type RentalPaymentScheduleSummary,
	type RentalPaymentSession,
	type RentalPaymentSummary,
	type RentalPricingBucket,
	useCollectCashPaymentMutation,
	useCommitRentalMutation,
	useFinalizeRentalMutation,
	usePrepareRentalPaymentMutation,
	useRecommitRentalMutation,
	useRentalAvailabilityQuery,
	useRentalDraftQuery,
} from "@/features/rentals"
import { useVehicleCatalogQuery } from "@/features/vehicles"
import type { VehicleSummary } from "@/features/vehicles/types/vehicle"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { resolveErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { RentalDateTimePicker } from "./rental-date-time-picker"
import { RentalPaymentAuBecsForm } from "./rental-payment-au-becs-form"
import { RentalPaymentTerminalPanel } from "./rental-payment-terminal-panel"
import { RentalVehicleSelectionTable } from "./rental-vehicle-selection-table"

type RentalAppointmentDrawerProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	preselectedVehicleId?: string | null
	existingRentalId?: string | null
	onRentalFinalized?: (rentalId: string) => void
}

type RentalDrawerValues = {
	vehicleId: string
	customer: {
		fullName: string
		email: string
		phone: string
		matchedCustomerId: string | null
	}
	schedule: {
		plannedStartAt: string
		plannedEndAt: string
		matchMode: RentalAlternativeMatchMode
	}
	pricing: {
		taxRatePercent: number
		discountAmount: number
		depositRequired: boolean
		depositAmount: number
		notes: string
	}
	paymentPlan: {
		kind: RentalPaymentPlanKind
		firstCollectionTiming: RentalCollectionTiming
		installmentInterval: RentalInstallmentInterval | null
	}
	payment: {
		methodType: RentalPaymentMethodType
		amountTendered: string
	}
	agreement: {
		signerName: string
		signature: string
		agreementAccepted: boolean
	}
	pickupCondition: {
		changed: boolean
		rating: RentalConditionRating | null
		media: Array<{
			assetId: string
			deliveryUrl: string
			blurDataUrl: string
			label: string | null
		}>
		notes: string
	}
}

const steps = [
	{
		title: "Vehicle",
		description: "Choose the rental vehicle.",
	},
	{
		title: "Schedule",
		description: "Confirm pickup, return, and live vehicle availability.",
	},
	{
		title: "Customer",
		description: "Capture renter details after the schedule is available.",
	},
	{
		title: "Pricing & Plan",
		description: "Review the bucketed quote and payment schedule.",
	},
	{
		title: "Payment Setup",
		description:
			"Choose how the first charge and future charges will be handled.",
	},
	{
		title: "Agreement",
		description: "Review the rental summary and finalize the agreement.",
	},
] as const

const availabilityMatchModes: RentalAlternativeMatchMode[] = [
	"same_class",
	"same_class_transmission",
	"same_class_price_band",
	"same_class_brand_family",
]

function buildDefaultValues(
	preselectedVehicleId?: string | null,
): RentalDrawerValues {
	return {
		vehicleId: preselectedVehicleId ?? "",
		customer: {
			fullName: "",
			email: "",
			phone: "",
			matchedCustomerId: null,
		},
		schedule: {
			plannedStartAt: "",
			plannedEndAt: "",
			matchMode: "same_class",
		},
		pricing: {
			taxRatePercent: 10,
			discountAmount: 0,
			depositRequired: false,
			depositAmount: 0,
			notes: "",
		},
		paymentPlan: {
			kind: "single",
			firstCollectionTiming: "setup",
			installmentInterval: null,
		},
		payment: {
			methodType: "cash",
			amountTendered: "",
		},
		agreement: {
			signerName: "",
			signature: "",
			agreementAccepted: false,
		},
		pickupCondition: {
			changed: false,
			rating: null,
			media: [],
			notes: "",
		},
	}
}

function inferTaxRatePercent(detail: RentalDetailResponse) {
	const snapshot = detail.pricingSnapshot
	if (!snapshot) {
		return 10
	}

	const taxableBase = Math.max(0, snapshot.subtotal - snapshot.discountTotal)
	if (taxableBase <= 0) {
		return 0
	}

	return Number(((snapshot.taxTotal / taxableBase) * 100).toFixed(2))
}

function buildValuesFromDetail(
	detail: RentalDetailResponse,
): RentalDrawerValues {
	const pickupInspection =
		detail.inspections.find((inspection) => inspection.stage === "pickup") ??
		null

	return {
		vehicleId: detail.rental.vehicleId ?? "",
		customer: {
			fullName: detail.customer?.fullName ?? "",
			email: detail.customer?.email ?? "",
			phone: detail.customer?.phone ?? "",
			matchedCustomerId: detail.customer?.id ?? null,
		},
		schedule: {
			plannedStartAt: toDatetimeInputValue(detail.rental.plannedStartAt),
			plannedEndAt: toDatetimeInputValue(detail.rental.plannedEndAt),
			matchMode: "same_class",
		},
		pricing: {
			taxRatePercent: inferTaxRatePercent(detail),
			discountAmount: detail.pricingSnapshot?.discountTotal ?? 0,
			depositRequired: detail.rental.depositRequired,
			depositAmount: detail.rental.depositAmount ?? 0,
			notes: detail.rental.notes ?? "",
		},
		paymentPlan: {
			kind: detail.rental.paymentPlanKind,
			firstCollectionTiming: detail.rental.firstCollectionTiming,
			installmentInterval: detail.rental.installmentInterval,
		},
		payment: {
			methodType: detail.rental.selectedPaymentMethodType ?? "cash",
			amountTendered: "",
		},
		agreement: {
			signerName: "",
			signature: "",
			agreementAccepted: Boolean(detail.agreement?.signedAt),
		},
		pickupCondition: {
			changed: Boolean(
				pickupInspection?.conditionRating ||
					(pickupInspection?.media.length ?? 0) > 0,
			),
			rating: pickupInspection?.conditionRating ?? null,
			media:
				pickupInspection?.media.map((item) => ({
					assetId: item.assetId,
					deliveryUrl: item.deliveryUrl,
					blurDataUrl: item.blurDataUrl ?? "",
					label: item.label,
				})) ?? [],
			notes: pickupInspection?.notes ?? "",
		},
	}
}

function toIsoFromDatetimeInput(value: string) {
	const parsed = new Date(value)
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function toDatetimeInputValue(value: string | null) {
	if (!value) {
		return ""
	}

	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return ""
	}

	const timezoneOffsetMs = parsed.getTimezoneOffset() * 60_000
	return new Date(parsed.getTime() - timezoneOffsetMs)
		.toISOString()
		.slice(0, 16)
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
		return "Not set"
	}

	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return "Not set"
	}

	return parsed.toLocaleString("en-AU", {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

function formatBucketLabel(bucket: RentalPricingBucket | null) {
	switch (bucket) {
		case "day":
			return "Daily"
		case "week":
			return "Weekly"
		case "month":
			return "Monthly"
		default:
			return "Not selected"
	}
}

function formatPaymentPlanLabel(kind: RentalPaymentPlanKind) {
	return kind === "single" ? "Single payment" : "Installments"
}

function formatTimingLabel(timing: RentalCollectionTiming) {
	return timing === "setup" ? "Collect at setup" : "Collect at handover"
}

function paymentMethodLabel(method: RentalPaymentMethodType) {
	switch (method) {
		case "cash":
			return "Cash"
		case "card":
			return "Card / POS"
		case "au_becs_debit":
			return "Direct debit"
	}
}

function describeRecurringStartTiming(timing: RentalCollectionTiming) {
	return timing === "setup"
		? "Stripe recurring billing starts after finalization."
		: "Stripe recurring billing starts during handover."
}

function formatInstallmentIntervalLabel(
	interval: RentalInstallmentInterval | null,
) {
	if (interval === "week") {
		return "Weekly"
	}

	if (interval === "month") {
		return "Monthly"
	}

	return "Single payment"
}

function formatRecurringBillingStateLabel(
	state: RentalDetailResponse["rental"]["recurringBillingState"],
) {
	switch (state) {
		case "none":
			return "Not started"
		case "pending_setup":
			return "Pending setup"
		case "ready_to_schedule":
			return "Awaiting Stripe start"
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
	state: RentalDetailResponse["rental"]["recurringBillingState"],
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

function usesStripeManagedRecurring(detail: RentalDetailResponse | null) {
	return Boolean(
		detail &&
			detail.rental.paymentPlanKind === "installment" &&
			detail.rental.selectedPaymentMethodType &&
			detail.rental.selectedPaymentMethodType !== "cash",
	)
}

function getBucketRate(
	vehicle: VehicleSummary | null,
	bucket: RentalPricingBucket | null,
) {
	if (!vehicle || !bucket) {
		return null
	}

	const pricingModel =
		bucket === "day" ? "Daily" : bucket === "week" ? "Weekly" : "Monthly"

	return (
		vehicle.rates.find((rate) => rate.pricingModel === pricingModel) ?? null
	)
}

function isScheduleStepValid(values: RentalDrawerValues) {
	const startIso = toIsoFromDatetimeInput(values.schedule.plannedStartAt)
	const endIso = toIsoFromDatetimeInput(values.schedule.plannedEndAt)

	return Boolean(
		values.vehicleId &&
			startIso &&
			endIso &&
			new Date(endIso) > new Date(startIso),
	)
}

function isCustomerStepValid(values: RentalDrawerValues) {
	return Boolean(
		values.customer.fullName.trim() &&
			(values.customer.email.trim() || values.customer.phone.trim()),
	)
}

function formatAvailabilityModeLabel(mode: RentalAlternativeMatchMode) {
	switch (mode) {
		case "same_class":
			return "Same class"
		case "same_class_transmission":
			return "Class + transmission"
		case "same_class_price_band":
			return "Class + price band"
		case "same_class_brand_family":
			return "Class + brand family"
	}
}

function formatAvailabilityStatusColor(
	status: "available" | "partial" | "blocked",
) {
	switch (status) {
		case "available":
			return "border-emerald-200 bg-emerald-50 text-emerald-700"
		case "partial":
			return "border-amber-200 bg-amber-50 text-amber-700"
		case "blocked":
			return "border-destructive/30 bg-destructive/10 text-destructive"
	}
}

function hasPaymentAttemptForSchedule(
	payments: RentalPaymentSummary[],
	scheduleId: string | null | undefined,
) {
	if (!scheduleId) {
		return false
	}

	return payments.some(
		(payment) =>
			payment.kind === "schedule_collection" &&
			payment.scheduleId === scheduleId,
	)
}

function getLatestPaymentByIntent(payments: RentalPaymentSummary[]) {
	return payments.find(
		(payment) =>
			payment.status === "requires_action" ||
			payment.status === "processing" ||
			payment.status === "pending",
	)
}

function canContinueFromPayment(detail: RentalDetailResponse | null) {
	if (!detail?.rental.selectedPaymentMethodType) {
		return false
	}

	const firstSchedule = detail.paymentSchedule[0]
	if (!firstSchedule) {
		return false
	}

	const selectedMethod = detail.rental.selectedPaymentMethodType
	const isInstallment = detail.rental.paymentPlanKind === "installment"
	const isSetup = detail.rental.firstCollectionTiming === "setup"

	if (!isSetup) {
		if (selectedMethod === "cash") {
			return true
		}

		if (selectedMethod === "card") {
			return (
				!isInstallment || detail.rental.storedPaymentMethodStatus === "ready"
			)
		}

		return detail.rental.storedPaymentMethodStatus === "ready"
	}

	if (selectedMethod === "cash") {
		return firstSchedule.status === "succeeded"
	}

	if (selectedMethod === "card") {
		return (
			firstSchedule.status === "succeeded" &&
			(!isInstallment || detail.rental.storedPaymentMethodStatus === "ready")
		)
	}

	const firstChargeInitiated =
		firstSchedule.status === "succeeded" ||
		firstSchedule.status === "processing" ||
		hasPaymentAttemptForSchedule(detail.payments, firstSchedule.id)

	return (
		firstChargeInitiated &&
		(!isInstallment || detail.rental.storedPaymentMethodStatus === "ready")
	)
}

function QuoteLineItems({
	lineItems,
	currency,
}: {
	lineItems: Array<{
		code: string
		label: string
		amount: number
		type: "charge" | "tax" | "discount" | "deposit"
	}>
	currency: string
}) {
	return (
		<div className="space-y-2 rounded-xl border p-4">
			{lineItems.map((item) => (
				<div
					key={item.code}
					className="flex items-center justify-between gap-3 text-sm"
				>
					<p className="text-muted-foreground">{item.label}</p>
					<p className={item.type === "discount" ? "text-emerald-700" : ""}>
						{item.type === "discount" ? "-" : ""}
						{formatCurrency(item.amount, currency)}
					</p>
				</div>
			))}
		</div>
	)
}

function PaymentScheduleTable({
	rows,
	currency,
}: {
	rows: Array<{
		sequence: number
		label: string
		dueAt: string
		amount: number
		isFirstCharge: boolean
		status?: RentalPaymentScheduleSummary["status"]
		stripeInvoiceId?: string | null
		stripeSubscriptionId?: string | null
		failureReason?: string | null
	}>
	currency: string
}) {
	return (
		<div className="overflow-hidden rounded-xl border">
			<div className="grid grid-cols-[80px_minmax(0,1fr)_180px_140px] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
				<p>#</p>
				<p>Charge</p>
				<p>Due</p>
				<p className="text-right">Amount</p>
			</div>
			{rows.map((row) => (
				<div
					key={`${row.sequence}-${row.dueAt}`}
					className="grid grid-cols-[80px_minmax(0,1fr)_180px_140px] gap-3 border-b px-4 py-3 text-sm last:border-b-0"
				>
					<p>{row.sequence}</p>
					<div className="space-y-1">
						<p className="font-medium">{row.label}</p>
						<p className="text-muted-foreground text-xs">
							{row.isFirstCharge
								? "First scheduled charge"
								: "Scheduled charge"}
							{row.status ? ` • ${row.status.replaceAll("_", " ")}` : ""}
						</p>
						{row.stripeInvoiceId || row.stripeSubscriptionId ? (
							<p className="text-muted-foreground text-[11px]">
								{row.stripeInvoiceId
									? `Invoice ${row.stripeInvoiceId}`
									: "Invoice pending"}
								{row.stripeSubscriptionId
									? ` • Subscription ${row.stripeSubscriptionId}`
									: ""}
							</p>
						) : null}
						{row.failureReason ? (
							<p className="text-[11px] text-destructive">
								{row.failureReason}
							</p>
						) : null}
					</div>
					<p>{formatDateTime(row.dueAt)}</p>
					<p className="text-right font-medium">
						{formatCurrency(row.amount, currency)}
					</p>
				</div>
			))}
		</div>
	)
}

function PaymentSchedulePreviewCards({
	rows,
	currency,
}: {
	rows: Array<{
		sequence: number
		label: string
		dueAt: string
		amount: number
		isFirstCharge: boolean
		status?: RentalPaymentScheduleSummary["status"]
	}>
	currency: string
}) {
	return (
		<div className="space-y-3">
			{rows.map((row) => (
				<div
					key={`${row.sequence}-${row.dueAt}`}
					className="rounded-2xl border bg-background/80 p-4"
				>
					<div className="flex items-start justify-between gap-3">
						<div className="space-y-1">
							<p className="text-sm font-semibold">
								#{row.sequence} {row.label}
							</p>
							<p className="text-muted-foreground text-xs">
								{row.isFirstCharge
									? "First scheduled charge"
									: "Scheduled charge"}
								{row.status ? ` • ${row.status.replaceAll("_", " ")}` : ""}
							</p>
						</div>
						<p className="text-sm font-semibold">
							{formatCurrency(row.amount, currency)}
						</p>
					</div>
					<p className="text-muted-foreground mt-3 text-sm">
						{formatDateTime(row.dueAt)}
					</p>
				</div>
			))}
		</div>
	)
}

function StepCard({
	index,
	title,
	description,
	active,
	completed,
}: {
	index: number
	title: string
	description: string
	active: boolean
	completed: boolean
}) {
	return (
		<div
			className={cn(
				"min-w-60 rounded-[26px] border px-4 py-4 transition md:min-w-0",
				active && "border-primary bg-primary/8 shadow-sm",
				completed && "border-emerald-300 bg-emerald-50",
			)}
		>
			<div className="flex items-center gap-3">
				<div
					className={cn(
						"flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
						completed && "border-emerald-500 bg-emerald-500 text-white",
						active &&
							!completed &&
							"border-primary bg-primary text-primary-foreground",
					)}
				>
					{completed ? <CheckCircle2 className="size-4" /> : index + 1}
				</div>
				<div className="space-y-0.5">
					<p className="text-sm font-semibold">{title}</p>
					<p className="text-muted-foreground text-xs">{description}</p>
				</div>
			</div>
		</div>
	)
}

function PaymentMethodCard({
	title,
	description,
	icon,
	selected,
	readyLabel,
	onSelect,
}: {
	title: string
	description: string
	icon: ReactNode
	selected: boolean
	readyLabel: string
	onSelect: () => void
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"w-full rounded-[26px] border p-4 text-left transition",
				selected
					? "border-primary bg-primary/8 ring-primary/15 ring-4"
					: "bg-background hover:border-primary/30 hover:shadow-sm",
			)}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-3">
					<div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-foreground">
						{icon}
					</div>
					<div>
						<p className="font-semibold">{title}</p>
						<p className="text-muted-foreground mt-1 text-sm">{description}</p>
					</div>
				</div>
				<Badge
					variant="outline"
					className={
						selected ? "border-primary/40 bg-primary/10 text-primary" : ""
					}
				>
					{readyLabel}
				</Badge>
			</div>
		</button>
	)
}

export function RentalAppointmentDrawer({
	open,
	onOpenChange,
	preselectedVehicleId,
	existingRentalId,
	onRentalFinalized,
}: RentalAppointmentDrawerProps) {
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const queryVehicles = useVehicleCatalogQuery(activeOrganizationId)
	const commitRentalMutation = useCommitRentalMutation(activeOrganizationId)
	const recommitRentalMutation = useRecommitRentalMutation(activeOrganizationId)
	const preparePaymentMutation =
		usePrepareRentalPaymentMutation(activeOrganizationId)
	const collectCashPaymentMutation =
		useCollectCashPaymentMutation(activeOrganizationId)
	const finalizeRentalMutation = useFinalizeRentalMutation(activeOrganizationId)

	const [step, setStep] = useState(0)
	const [values, setValues] = useState<RentalDrawerValues>(() =>
		buildDefaultValues(preselectedVehicleId),
	)
	const [drawerError, setDrawerError] = useState<string | null>(null)
	const [draftRentalId, setDraftRentalId] = useState<string | null>(null)
	const [cachedDetail, setCachedDetail] = useState<RentalDetailResponse | null>(
		null,
	)
	const [paymentSession, setPaymentSession] =
		useState<RentalPaymentSession | null>(null)
	const [activePaymentSetupDrawer, setActivePaymentSetupDrawer] =
		useState<RentalPaymentMethodType | null>(null)
	const agreementAcceptedSwitchId = "rental-agreement-accepted"

	const rentalDraftQuery = useRentalDraftQuery(
		activeOrganizationId,
		draftRentalId ?? existingRentalId ?? undefined,
	)

	const currentDetail = rentalDraftQuery.data ?? cachedDetail

	const vehicles = queryVehicles.data?.vehicles ?? []
	const selectedVehicle =
		vehicles.find((vehicle) => vehicle.id === values.vehicleId) ?? null
	const scheduleStartIso = toIsoFromDatetimeInput(
		values.schedule.plannedStartAt,
	)
	const scheduleEndIso = toIsoFromDatetimeInput(values.schedule.plannedEndAt)
	const debouncedCustomerEmail = useDebouncedValue(values.customer.email)
	const debouncedCustomerPhone = useDebouncedValue(values.customer.phone)
	const rawLookupReady = hasCustomerLookupInput({
		email: values.customer.email,
		phone: values.customer.phone,
	})
	const debouncedLookupReady = hasCustomerLookupInput({
		email: debouncedCustomerEmail,
		phone: debouncedCustomerPhone,
	})
	const lookupSettling =
		rawLookupReady &&
		(values.customer.email !== debouncedCustomerEmail ||
			values.customer.phone !== debouncedCustomerPhone)

	const customerLookupQuery = useCustomerLookupQuery({
		organizationId: activeOrganizationId,
		email: debouncedCustomerEmail,
		phone: debouncedCustomerPhone,
		enabled: open && step === 2,
	})

	const availabilityQuery = useRentalAvailabilityQuery({
		organizationId: activeOrganizationId,
		vehicleId: values.vehicleId || null,
		rentalId: draftRentalId ?? existingRentalId ?? null,
		startsAt: scheduleStartIso,
		endsAt: scheduleEndIso,
		matchMode: values.schedule.matchMode,
		enabled: open && Boolean(values.vehicleId) && step >= 1,
	})

	useEffect(() => {
		if (!open) {
			setStep(0)
			setValues(buildDefaultValues(preselectedVehicleId))
			setDrawerError(null)
			setDraftRentalId(null)
			setCachedDetail(null)
			setPaymentSession(null)
			return
		}

		if (existingRentalId) {
			setDraftRentalId(existingRentalId)
		}

		setValues((current) =>
			current.vehicleId || !preselectedVehicleId
				? current
				: {
						...current,
						vehicleId: preselectedVehicleId,
					},
		)
	}, [existingRentalId, open, preselectedVehicleId])

	useEffect(() => {
		if (step !== 4) {
			setActivePaymentSetupDrawer(null)
		}
	}, [step])

	useEffect(() => {
		if (!open || !existingRentalId || !currentDetail) {
			return
		}

		setValues(buildValuesFromDetail(currentDetail))
	}, [currentDetail, existingRentalId, open])

	const quotePreview = useMemo(() => {
		const startIso = toIsoFromDatetimeInput(values.schedule.plannedStartAt)
		const endIso = toIsoFromDatetimeInput(values.schedule.plannedEndAt)
		if (!selectedVehicle || !startIso || !endIso) {
			return {
				quote: null,
				error: null,
			}
		}

		try {
			return {
				quote: computeRentalQuote({
					plannedStartAt: startIso,
					plannedEndAt: endIso,
					taxRatePercent: values.pricing.taxRatePercent,
					discountAmount: values.pricing.discountAmount,
					depositRequired: values.pricing.depositRequired,
					depositAmount: values.pricing.depositAmount,
					rates: selectedVehicle.rates,
				}),
				error: null,
			}
		} catch (error) {
			return {
				quote: null,
				error: resolveErrorMessage(
					error,
					"Unable to calculate the rental quote.",
				),
			}
		}
	}, [
		selectedVehicle,
		values.pricing.depositAmount,
		values.pricing.depositRequired,
		values.pricing.discountAmount,
		values.pricing.taxRatePercent,
		values.schedule.plannedEndAt,
		values.schedule.plannedStartAt,
	])

	useEffect(() => {
		if (
			values.paymentPlan.kind === "installment" &&
			!values.paymentPlan.installmentInterval &&
			quotePreview.quote
		) {
			setValues((current) => ({
				...current,
				paymentPlan: {
					...current.paymentPlan,
					installmentInterval: defaultInstallmentIntervalForDuration(
						quotePreview.quote.durationDays,
					),
				},
			}))
		}
	}, [
		quotePreview.quote,
		values.paymentPlan.installmentInterval,
		values.paymentPlan.kind,
	])

	const schedulePreview = useMemo(() => {
		const startIso = toIsoFromDatetimeInput(values.schedule.plannedStartAt)
		const endIso = toIsoFromDatetimeInput(values.schedule.plannedEndAt)
		if (!quotePreview.quote || !startIso || !endIso) {
			return {
				rows: [],
				error: null,
				installmentInterval: null as RentalInstallmentInterval | null,
			}
		}

		const resolvedInstallmentInterval =
			values.paymentPlan.kind === "installment"
				? (values.paymentPlan.installmentInterval ??
					defaultInstallmentIntervalForDuration(
						quotePreview.quote.durationDays,
					))
				: null

		try {
			return {
				rows: buildRentalPaymentSchedulePreview({
					plannedStartAt: startIso,
					plannedEndAt: endIso,
					grandTotal: quotePreview.quote.grandTotal,
					depositAmount: quotePreview.quote.depositAmount,
					paymentPlanKind: values.paymentPlan.kind,
					firstCollectionTiming: values.paymentPlan.firstCollectionTiming,
					installmentInterval: resolvedInstallmentInterval,
					installmentCount: null,
				}),
				error: null,
				installmentInterval: resolvedInstallmentInterval,
			}
		} catch (error) {
			return {
				rows: [],
				error: resolveErrorMessage(
					error,
					"Unable to calculate the payment schedule.",
				),
				installmentInterval: resolvedInstallmentInterval,
			}
		}
	}, [
		quotePreview.quote,
		values.paymentPlan.firstCollectionTiming,
		values.paymentPlan.installmentInterval,
		values.paymentPlan.kind,
		values.schedule.plannedEndAt,
		values.schedule.plannedStartAt,
	])

	const matchedCustomerCandidates = customerLookupQuery.data?.customers ?? []
	const showLookupGuidance = !rawLookupReady
	const showLookupSettling = rawLookupReady && lookupSettling
	const showLookupLoading =
		debouncedLookupReady &&
		!showLookupSettling &&
		customerLookupQuery.isFetching
	const showLookupError =
		debouncedLookupReady &&
		!showLookupSettling &&
		Boolean(customerLookupQuery.error)
	const showLookupCandidates =
		debouncedLookupReady &&
		!showLookupSettling &&
		!customerLookupQuery.isFetching &&
		matchedCustomerCandidates.length > 0
	const selectedBucketRate = getBucketRate(
		selectedVehicle,
		quotePreview.quote?.pricingBucket ?? null,
	)

	function setField<K extends keyof RentalDrawerValues>(
		key: K,
		value: RentalDrawerValues[K],
	) {
		setValues((current) => ({
			...current,
			[key]: value,
		}))
	}

	function setManualCustomerField(
		key: "fullName" | "email" | "phone",
		value: string,
	) {
		setField("customer", {
			...values.customer,
			[key]: value,
			matchedCustomerId: null,
		})
	}

	function openPaymentSetup(methodType: RentalPaymentMethodType) {
		setField("payment", {
			...values.payment,
			methodType,
		})
		setPaymentSession(null)
		setActivePaymentSetupDrawer(methodType)
	}

	function buildScheduleDraftPayload(): RentalCommitPayload {
		const plannedStartAt = toIsoFromDatetimeInput(
			values.schedule.plannedStartAt,
		)
		const plannedEndAt = toIsoFromDatetimeInput(values.schedule.plannedEndAt)

		if (!plannedStartAt || !plannedEndAt) {
			throw new Error("Valid rental dates are required.")
		}

		return {
			vehicleId: values.vehicleId,
			schedule: {
				plannedStartAt,
				plannedEndAt,
			},
		}
	}

	function buildCommitPayload(): RentalCommitPayload {
		if (!quotePreview.quote) {
			throw new Error("Pricing preview is incomplete.")
		}

		const plannedStartAt = toIsoFromDatetimeInput(
			values.schedule.plannedStartAt,
		)
		const plannedEndAt = toIsoFromDatetimeInput(values.schedule.plannedEndAt)

		if (!plannedStartAt || !plannedEndAt) {
			throw new Error("Valid rental dates are required.")
		}

		if (schedulePreview.rows.length === 0) {
			throw new Error("Payment schedule preview is empty.")
		}

		return {
			vehicleId: values.vehicleId,
			customer: {
				fullName: values.customer.fullName.trim(),
				email: values.customer.email.trim() || undefined,
				phone: values.customer.phone.trim() || undefined,
				matchedCustomerId: values.customer.matchedCustomerId,
			},
			schedule: {
				plannedStartAt,
				plannedEndAt,
			},
			pricing: {
				pricingBucket: quotePreview.quote.pricingBucket,
				unitCount: quotePreview.quote.unitCount,
				baseRate: quotePreview.quote.baseRate,
				subtotal: quotePreview.quote.subtotal,
				discountAmount: quotePreview.quote.discountTotal,
				taxRatePercent: values.pricing.taxRatePercent,
				taxTotal: quotePreview.quote.taxTotal,
				depositRequired:
					values.pricing.depositRequired ||
					Boolean(selectedBucketRate?.requiresDeposit),
				depositAmount: quotePreview.quote.depositAmount,
				grandTotal: quotePreview.quote.grandTotal,
				lineItems: quotePreview.quote.lineItems,
			},
			paymentPlan: {
				paymentPlanKind: values.paymentPlan.kind,
				firstCollectionTiming: values.paymentPlan.firstCollectionTiming,
				installmentInterval: schedulePreview.installmentInterval,
				installmentCount:
					values.paymentPlan.kind === "installment"
						? schedulePreview.rows.length
						: null,
				schedule: schedulePreview.rows.map((row) => ({
					sequence: row.sequence,
					label: row.label,
					dueAt: row.dueAt,
					amount: row.amount,
					isFirstCharge: row.isFirstCharge,
				})),
			},
			notes: values.pricing.notes.trim() || undefined,
		}
	}

	async function saveScheduleDraftAndAdvance() {
		try {
			setDrawerError(null)
			const payload = buildScheduleDraftPayload()
			const response = draftRentalId
				? await recommitRentalMutation.mutateAsync({
						rentalId: draftRentalId,
						payload,
					})
				: await commitRentalMutation.mutateAsync(payload)

			setCachedDetail(response)
			setDraftRentalId(response.rental.id)
			setPaymentSession(null)
			setStep(2)
		} catch (error) {
			setDrawerError(
				resolveErrorMessage(error, "Failed to save the schedule hold."),
			)
		}
	}

	async function saveDraftAndAdvance() {
		try {
			setDrawerError(null)
			const payload = buildCommitPayload()
			const response = draftRentalId
				? await recommitRentalMutation.mutateAsync({
						rentalId: draftRentalId,
						payload,
					})
				: await commitRentalMutation.mutateAsync(payload)

			setCachedDetail(response)
			setDraftRentalId(response.rental.id)
			setPaymentSession(null)
			setStep(4)
		} catch (error) {
			setDrawerError(resolveErrorMessage(error, "Failed to save rental draft."))
		}
	}

	async function preparePayment(methodType: RentalPaymentMethodType) {
		if (!draftRentalId || !currentDetail) {
			return
		}

		try {
			setDrawerError(null)
			const firstPendingSchedule =
				currentDetail.paymentSchedule.find(
					(row) => row.status !== "succeeded",
				) ?? currentDetail.paymentSchedule[0]

			const result = await preparePaymentMutation.mutateAsync({
				rentalId: draftRentalId,
				payload: {
					paymentMethodType: methodType,
					scheduleId: firstPendingSchedule?.id,
				},
			})

			setPaymentSession(result.paymentSession)
			await rentalDraftQuery.refetch()

			if (
				methodType === "cash" &&
				currentDetail.rental.firstCollectionTiming === "handover"
			) {
				toast.success("Cash collection has been deferred to handover.")
			} else if (
				methodType === "card" &&
				currentDetail.rental.firstCollectionTiming === "handover" &&
				currentDetail.rental.paymentPlanKind === "single"
			) {
				toast.success("Card collection will be handled at handover.")
			} else {
				toast.success(`${paymentMethodLabel(methodType)} setup is ready.`)
			}
		} catch (error) {
			setDrawerError(resolveErrorMessage(error, "Failed to prepare payment."))
		}
	}

	async function collectCash() {
		if (!draftRentalId || !currentDetail) {
			return
		}

		const firstSchedule = currentDetail.paymentSchedule[0]
		if (!firstSchedule) {
			setDrawerError("No payment schedule row is available.")
			return
		}

		const amountTendered = Number(values.payment.amountTendered)
		if (!Number.isFinite(amountTendered)) {
			setDrawerError(
				"Enter the amount tendered before marking cash as collected.",
			)
			return
		}

		try {
			setDrawerError(null)
			const result = await collectCashPaymentMutation.mutateAsync({
				rentalId: draftRentalId,
				payload: {
					scheduleId: firstSchedule.id,
					amountTendered,
				},
			})
			await rentalDraftQuery.refetch()
			toast.success(
				`Cash collected. Change due: ${formatCurrency(
					result.changeDue,
					currentDetail.rental.currency,
				)}.`,
			)
		} catch (error) {
			setDrawerError(
				resolveErrorMessage(error, "Failed to collect cash payment."),
			)
		}
	}

	async function finalizeRental() {
		if (!draftRentalId) {
			return
		}

		try {
			setDrawerError(null)

			const result = await finalizeRentalMutation.mutateAsync({
				rentalId: draftRentalId,
				payload: {
					signerName: values.agreement.signerName.trim() || undefined,
					signature: values.agreement.signature.trim(),
					agreementAccepted: values.agreement.agreementAccepted,
				},
			})
			toast.success("Rental finalized.")
			onRentalFinalized?.(result.rentalId)
			onOpenChange(false)
		} catch (error) {
			setDrawerError(resolveErrorMessage(error, "Failed to finalize rental."))
		}
	}

	function onNext() {
		if (step === 0) {
			if (!values.vehicleId) {
				setDrawerError("Select a vehicle to continue.")
				return
			}

			setDrawerError(null)
			setStep(1)
			return
		}

		if (step === 1) {
			if (!isScheduleStepValid(values)) {
				setDrawerError(
					"Choose a valid pickup and return window before continuing.",
				)
				return
			}

			if (availabilityQuery.isFetching) {
				setDrawerError("Checking availability. Please wait a moment.")
				return
			}

			if (availabilityQuery.error) {
				setDrawerError("Resolve availability checks before continuing.")
				return
			}

			if (!availabilityQuery.data?.isAvailable) {
				setDrawerError(
					availabilityQuery.data?.blockingReason ??
						"Selected vehicle is unavailable for the chosen period.",
				)
				return
			}

			void saveScheduleDraftAndAdvance()
			return
		}

		if (step === 2) {
			if (!isCustomerStepValid(values)) {
				setDrawerError("Complete customer details before continuing.")
				return
			}

			setDrawerError(null)
			setStep(3)
			return
		}

		if (step === 3) {
			void saveDraftAndAdvance()
			return
		}

		if (step === 4) {
			if (!canContinueFromPayment(currentDetail)) {
				setDrawerError(
					"Complete the required payment setup or first collection before continuing.",
				)
				return
			}

			setDrawerError(null)
			setStep(5)
		}
	}

	const footerBusy =
		commitRentalMutation.isPending ||
		recommitRentalMutation.isPending ||
		preparePaymentMutation.isPending ||
		collectCashPaymentMutation.isPending ||
		finalizeRentalMutation.isPending

	const footerPrimaryLabel =
		step === 1
			? draftRentalId
				? "Refresh schedule hold"
				: "Hold schedule and continue"
			: step === 3
				? draftRentalId
					? "Save pricing and continue"
					: "Create draft and continue"
				: step === 5
					? "Finalize rental"
					: "Next"

	const firstSchedule = currentDetail?.paymentSchedule[0] ?? null
	const latestPendingPayment = currentDetail
		? getLatestPaymentByIntent(currentDetail.payments)
		: null
	const stripeManagedRecurring = usesStripeManagedRecurring(currentDetail)
	const recurringDebugRows = currentDetail
		? currentDetail.paymentSchedule.filter(
				(row) =>
					row.stripeInvoiceId || row.stripeSubscriptionId || row.failureReason,
			)
		: []
	const cashSetupLabel =
		firstSchedule?.status === "succeeded"
			? "Collected"
			: currentDetail?.rental.firstCollectionTiming === "handover"
				? "Handover"
				: "Setup"
	const cardSetupLabel =
		currentDetail?.rental.selectedPaymentMethodType === "card"
			? currentDetail.rental.storedPaymentMethodStatus.replaceAll("_", " ")
			: "Open setup"
	const directDebitSetupLabel =
		currentDetail?.rental.selectedPaymentMethodType === "au_becs_debit"
			? currentDetail.rental.storedPaymentMethodStatus.replaceAll("_", " ")
			: "Open setup"
	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent
				fullHeight
				className="overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),linear-gradient(to_bottom,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]"
			>
				<div className="shrink-0 border-b bg-background/90 backdrop-blur-sm">
					<DrawerHeader className="mx-auto w-full max-w-390 px-4 pb-4 pt-5 text-left sm:px-6 lg:px-8">
						<DrawerTitle className="text-2xl font-semibold tracking-tight">
							New rental checkout
						</DrawerTitle>
						<DrawerDescription className="max-w-3xl text-sm">
							Client-first rental setup with bucketed pricing, payment planning,
							and payment method setup before final agreement.
						</DrawerDescription>
					</DrawerHeader>
					<div className="mx-auto w-full max-w-390 px-4 pb-5 sm:px-6 lg:px-8">
						<div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-6 md:overflow-visible">
							{steps.map((item, index) => (
								<StepCard
									key={item.title}
									index={index}
									title={item.title}
									description={item.description}
									active={step === index}
									completed={index < step}
								/>
							))}
						</div>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="mx-auto flex w-full max-w-390 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
						{drawerError ? (
							<p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
								{drawerError}
							</p>
						) : null}

						{step === 0 ? (
							<FieldGroup className="space-y-5">
								<div className="rounded-[28px] border bg-background/85 p-5 sm:p-6">
									<div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
										<div>
											<p className="text-xl font-semibold">
												Choose the vehicle
											</p>
											<p className="text-muted-foreground mt-1 max-w-2xl text-sm">
												Start with a vehicle card that feels more like product
												selection than back-office setup. We keep only the
												details that matter for checkout.
											</p>
										</div>
										{selectedVehicle ? (
											<Badge className="rounded-full px-3 py-1.5 text-xs">
												{selectedVehicle.year} {selectedVehicle.brandName}{" "}
												{selectedVehicle.modelName}
											</Badge>
										) : null}
									</div>
								</div>
								<RentalVehicleSelectionTable
									vehicles={vehicles}
									selectedVehicleId={values.vehicleId || null}
									onSelectVehicle={(vehicleId) => {
										setDrawerError(null)
										setValues((current) => ({
											...current,
											vehicleId,
										}))
									}}
								/>
							</FieldGroup>
						) : null}

						{step === 1 ? (
							<FieldGroup className="space-y-6">
								<div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_460px]">
									<div className="space-y-5 rounded-[28px] border bg-background/85 p-5 sm:p-6">
										<div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
											<div>
												<p className="text-xl font-semibold">
													Availability-first schedule
												</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Confirm the pickup and return window before collecting
													customer details. The schedule must be valid for this
													vehicle or a suggested alternative.
												</p>
											</div>
											{selectedVehicle ? (
												<Badge
													variant="outline"
													className="rounded-full px-3 py-1"
												>
													{selectedVehicle.vehicleClassName ?? "Unclassified"} ·{" "}
													{selectedVehicle.transmission}
												</Badge>
											) : null}
										</div>

										<div className="grid gap-4 md:grid-cols-2">
											<Field>
												<FieldLabel>Planned pickup</FieldLabel>
												<RentalDateTimePicker
													title="Planned pickup"
													description="Choose the pickup date and time."
													value={values.schedule.plannedStartAt}
													onValueChange={(nextValue) =>
														setField("schedule", {
															...values.schedule,
															plannedStartAt: nextValue,
														})
													}
													placeholder="Select pickup"
												/>
											</Field>
											<Field>
												<FieldLabel>Planned return</FieldLabel>
												<RentalDateTimePicker
													title="Planned return"
													description="Choose the planned return date and time."
													value={values.schedule.plannedEndAt}
													onValueChange={(nextValue) =>
														setField("schedule", {
															...values.schedule,
															plannedEndAt: nextValue,
														})
													}
													placeholder="Select return"
												/>
											</Field>
										</div>

										<div className="space-y-3 rounded-[24px] border bg-muted/20 p-4">
											<div className="flex items-center justify-between gap-3">
												<div>
													<p className="text-sm font-semibold">
														Alternative matching
													</p>
													<p className="text-muted-foreground mt-1 text-sm">
														Change how fallback vehicles are suggested for the
														selected time window.
													</p>
												</div>
												<CalendarRange className="size-5 text-primary" />
											</div>
											<ToggleGroup
												type="single"
												variant="outline"
												size="sm"
												value={values.schedule.matchMode}
												onValueChange={(value) => {
													if (
														availabilityMatchModes.includes(
															value as RentalAlternativeMatchMode,
														)
													) {
														setField("schedule", {
															...values.schedule,
															matchMode: value as RentalAlternativeMatchMode,
														})
													}
												}}
												className="grid w-full gap-2 rounded-[22px] bg-background/80 p-1 md:grid-cols-2"
											>
												{availabilityMatchModes.map((mode) => (
													<ToggleGroupItem
														key={mode}
														value={mode}
														className="h-11 rounded-3xl data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
													>
														{formatAvailabilityModeLabel(mode)}
													</ToggleGroupItem>
												))}
											</ToggleGroup>
										</div>

										<div className="space-y-4 rounded-[24px] border bg-background/90 p-4">
											<div className="flex items-center justify-between gap-3">
												<div>
													<p className="font-semibold">Availability grid</p>
													<p className="text-muted-foreground mt-1 text-sm">
														Days in the selected window show whether the vehicle
														is free, partially blocked, or fully blocked.
													</p>
												</div>
												{availabilityQuery.isFetching ? (
													<LoaderCircle className="size-5 animate-spin text-primary" />
												) : null}
											</div>

											{!values.vehicleId ||
											!scheduleStartIso ||
											!scheduleEndIso ? (
												<div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
													Choose both pickup and return times to start checking
													availability.
												</div>
											) : availabilityQuery.error ? (
												<div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
													{resolveErrorMessage(
														availabilityQuery.error,
														"Unable to load availability.",
													)}
												</div>
											) : availabilityQuery.data ? (
												<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
													{availabilityQuery.data.dayCells.map((cell) => (
														<div
															key={cell.date}
															className={cn(
																"rounded-2xl border p-3",
																formatAvailabilityStatusColor(cell.status),
															)}
														>
															<p className="text-xs uppercase tracking-[0.14em]">
																{new Date(cell.date).toLocaleDateString(
																	"en-AU",
																	{
																		weekday: "short",
																	},
																)}
															</p>
															<p className="mt-1 font-semibold">
																{new Date(cell.date).toLocaleDateString(
																	"en-AU",
																	{
																		day: "numeric",
																		month: "short",
																	},
																)}
															</p>
															<p className="mt-2 text-xs">
																{cell.status === "available"
																	? "Fully available"
																	: cell.status === "partial"
																		? "Partially blocked"
																		: "Blocked"}
															</p>
															{cell.notes[0] ? (
																<p className="mt-2 text-xs leading-5">
																	{cell.notes[0]}
																</p>
															) : null}
														</div>
													))}
												</div>
											) : null}
										</div>
									</div>

									<div className="space-y-4 rounded-[28px] border bg-background/90 p-5 sm:p-6">
										<div className="space-y-2">
											<p className="text-base font-semibold">
												Selected vehicle status
											</p>
											<p className="text-muted-foreground text-sm">
												The rental can only continue once this window is
												available or you switch to an accepted alternative.
											</p>
										</div>

										<div className="rounded-[24px] border bg-muted/20 p-4">
											<p className="text-sm font-medium">
												{selectedVehicle
													? `${selectedVehicle.year} ${selectedVehicle.brandName} ${selectedVehicle.modelName}`
													: "No vehicle selected"}
											</p>
											{selectedVehicle ? (
												<p className="text-muted-foreground mt-1 text-sm">
													{selectedVehicle.licensePlate} ·{" "}
													{selectedVehicle.vehicleClassName ?? "Unclassified"} ·{" "}
													{selectedVehicle.transmission}
												</p>
											) : null}

											{availabilityQuery.data ? (
												<div className="mt-4 space-y-3">
													<Badge
														variant="outline"
														className={cn(
															"rounded-full px-3 py-1",
															availabilityQuery.data.isAvailable
																? "border-emerald-300 bg-emerald-50 text-emerald-700"
																: "border-destructive/30 bg-destructive/10 text-destructive",
														)}
													>
														{availabilityQuery.data.isAvailable
															? "Available for the full period"
															: "Unavailable for the selected period"}
													</Badge>
													{availabilityQuery.data.blockingReason ? (
														<p className="text-sm text-muted-foreground">
															{availabilityQuery.data.blockingReason}
														</p>
													) : null}
													{availabilityQuery.data.nextAvailableRange ? (
														<div className="rounded-2xl border bg-background p-3 text-sm">
															<p className="font-medium">Next exact slot</p>
															<p className="text-muted-foreground mt-1">
																{formatDateTime(
																	availabilityQuery.data.nextAvailableRange
																		.startsAt,
																)}{" "}
																to{" "}
																{formatDateTime(
																	availabilityQuery.data.nextAvailableRange
																		.endsAt,
																)}
															</p>
														</div>
													) : null}
												</div>
											) : (
												<p className="text-muted-foreground mt-3 text-sm">
													Availability appears here after both dates are
													selected.
												</p>
											)}
										</div>

										<div className="space-y-3">
											<div className="flex items-center justify-between gap-3">
												<p className="font-semibold">Suggested alternatives</p>
												{availabilityQuery.data ? (
													<Badge variant="outline" className="rounded-full">
														{formatAvailabilityModeLabel(
															availabilityQuery.data.matchMode,
														)}
													</Badge>
												) : null}
											</div>
											{availabilityQuery.data?.alternatives.length ? (
												availabilityQuery.data.alternatives.map(
													(alternative) => (
														<div
															key={alternative.vehicle.id}
															className="rounded-[24px] border bg-background p-4"
														>
															<div className="flex items-start justify-between gap-4">
																<div className="space-y-1">
																	<p className="font-semibold">
																		{alternative.vehicle.label}
																	</p>
																	<p className="text-muted-foreground text-sm">
																		{alternative.vehicle.licensePlate} ·{" "}
																		{alternative.vehicle.vehicleClassName ??
																			"Unclassified"}{" "}
																		· {alternative.vehicle.transmission}
																	</p>
																	<p className="text-muted-foreground text-sm">
																		{alternative.matchReasons.join(" · ")}
																	</p>
																</div>
																<Button
																	type="button"
																	size="sm"
																	className="h-10 rounded-full px-4"
																	onClick={() => {
																		setDrawerError(null)
																		setField(
																			"vehicleId",
																			alternative.vehicle.id,
																		)
																	}}
																>
																	Switch vehicle
																</Button>
															</div>
														</div>
													),
												)
											) : (
												<div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
													No same-branch alternatives matched this rule for the
													selected window.
												</div>
											)}
										</div>
									</div>
								</div>
							</FieldGroup>
						) : null}

						{step === 2 ? (
							<FieldGroup className="space-y-6">
								<div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
									<div className="space-y-5 rounded-[28px] border bg-background/85 p-5 sm:p-6">
										<div>
											<p className="text-xl font-semibold">Customer details</p>
											<p className="text-muted-foreground mt-1 text-sm">
												Now that the vehicle and schedule are locked in, capture
												the renter details or autofill a known customer.
											</p>
										</div>
										<div className="grid gap-4 md:grid-cols-2">
											<Field>
												<FieldLabel>Full name</FieldLabel>
												<Input
													value={values.customer.fullName}
													onChange={(event) =>
														setManualCustomerField(
															"fullName",
															event.target.value,
														)
													}
													className="h-12 rounded-2xl"
												/>
											</Field>
											<Field>
												<FieldLabel>Email</FieldLabel>
												<Input
													type="email"
													value={values.customer.email}
													onChange={(event) =>
														setManualCustomerField("email", event.target.value)
													}
													className="h-12 rounded-2xl"
												/>
											</Field>
											<Field>
												<FieldLabel>Phone</FieldLabel>
												<Input
													value={values.customer.phone}
													onChange={(event) =>
														setManualCustomerField("phone", event.target.value)
													}
													className="h-12 rounded-2xl"
												/>
											</Field>
											<div className="rounded-2xl border bg-muted/25 p-4">
												<p className="text-sm font-medium">Schedule lock</p>
												<p className="text-muted-foreground mt-1 text-sm">
													{formatDateTime(scheduleStartIso)} to{" "}
													{formatDateTime(scheduleEndIso)}
												</p>
											</div>
										</div>
									</div>

									<div className="space-y-4 rounded-[28px] border bg-background/90 p-5 sm:p-6">
										<div className="flex items-center justify-between gap-3">
											<div>
												<p className="text-base font-semibold">
													Existing customer suggestions
												</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Autofill a known customer to speed up booking.
												</p>
											</div>
											{showLookupLoading ? (
												<LoaderCircle className="size-5 animate-spin text-primary" />
											) : (
												<Sparkles className="size-5 text-primary" />
											)}
										</div>

										{showLookupGuidance ? (
											<div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
												Enter an email or at least 7 phone digits to start
												customer lookup.
											</div>
										) : showLookupSettling ? (
											<div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
												Pause typing for a moment and we will search matching
												customers.
											</div>
										) : showLookupLoading ? (
											<div className="rounded-2xl border bg-muted/30 p-4">
												<div className="flex items-center gap-3 text-sm">
													<LoaderCircle className="size-4 animate-spin text-primary" />
													Checking existing customers...
												</div>
											</div>
										) : showLookupError ? (
											<div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
												Unable to check existing customers right now.
											</div>
										) : showLookupCandidates ? (
											<div className="space-y-3">
												{matchedCustomerCandidates.map((candidate) => (
													<div
														key={candidate.id}
														className={cn(
															"rounded-[24px] border p-4 transition",
															values.customer.matchedCustomerId ===
																candidate.id && "border-primary bg-primary/6",
														)}
													>
														<div className="flex items-start justify-between gap-4">
															<div className="flex items-start gap-3">
																<div className="flex size-11 items-center justify-center rounded-2xl bg-muted font-semibold">
																	{candidate.fullName
																		.split(" ")
																		.slice(0, 2)
																		.map((part) => part.charAt(0))
																		.join("")}
																</div>
																<div className="space-y-1">
																	<p className="font-semibold">
																		{candidate.fullName}
																	</p>
																	<p className="text-muted-foreground text-sm">
																		{candidate.email ?? "No email"}
																	</p>
																	<p className="text-muted-foreground text-sm">
																		{candidate.phone ?? "No phone"}
																	</p>
																</div>
															</div>
															<Button
																type="button"
																size="sm"
																className="h-10 rounded-full px-4"
																onClick={() =>
																	setField("customer", {
																		...values.customer,
																		fullName: candidate.fullName,
																		email: candidate.email ?? "",
																		phone: candidate.phone ?? "",
																		matchedCustomerId: candidate.id,
																	})
																}
															>
																<WandSparkles className="size-4" />
																Autofill
															</Button>
														</div>
													</div>
												))}
											</div>
										) : (
											<div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
												No existing customer matched this email or phone yet.
											</div>
										)}
									</div>
								</div>
							</FieldGroup>
						) : null}

						{step === 3 ? (
							<FieldGroup className="space-y-6">
								<div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
									<div className="space-y-6 rounded-[28px] border bg-background/90 p-5 sm:p-6">
										<div>
											<p className="text-xl font-semibold">Pricing and plan</p>
											<p className="text-muted-foreground mt-1 text-sm">
												Shape the rental charge strategy on the left while the
												quote and schedule stay visible on the right.
											</p>
										</div>

										<div className="grid gap-4 md:grid-cols-2">
											<Field>
												<FieldLabel>Payment plan</FieldLabel>
												<ToggleGroup
													type="single"
													variant="outline"
													size="lg"
													value={values.paymentPlan.kind}
													onValueChange={(value) => {
														if (value === "single" || value === "installment") {
															setField("paymentPlan", {
																...values.paymentPlan,
																kind: value,
																installmentInterval:
																	value === "installment"
																		? values.paymentPlan.installmentInterval
																		: null,
															})
														}
													}}
													className="grid w-full grid-cols-2 gap-2 rounded-[24px] bg-muted/40 p-1"
												>
													<ToggleGroupItem
														value="single"
														className="h-12 rounded-[18px] data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
													>
														Single payment
													</ToggleGroupItem>
													<ToggleGroupItem
														value="installment"
														className="h-12 rounded-[18px] data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
													>
														Installments
													</ToggleGroupItem>
												</ToggleGroup>
											</Field>
											<Field>
												<FieldLabel>First collection timing</FieldLabel>
												<ToggleGroup
													type="single"
													variant="outline"
													size="lg"
													value={values.paymentPlan.firstCollectionTiming}
													onValueChange={(value) => {
														if (value === "setup" || value === "handover") {
															setField("paymentPlan", {
																...values.paymentPlan,
																firstCollectionTiming: value,
															})
														}
													}}
													className="grid w-full grid-cols-2 gap-2 rounded-[24px] bg-muted/40 p-1"
												>
													<ToggleGroupItem
														value="setup"
														className="h-12 rounded-[18px] data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
													>
														At setup
													</ToggleGroupItem>
													<ToggleGroupItem
														value="handover"
														className="h-12 rounded-[18px] data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
													>
														At handover
													</ToggleGroupItem>
												</ToggleGroup>
											</Field>
											<Field>
												<FieldLabel>Tax rate %</FieldLabel>
												<Input
													type="number"
													value={values.pricing.taxRatePercent}
													onChange={(event) =>
														setField("pricing", {
															...values.pricing,
															taxRatePercent: Number(event.target.value || 0),
														})
													}
													className="h-12 rounded-2xl"
												/>
											</Field>
											<Field>
												<FieldLabel>Discount amount</FieldLabel>
												<Input
													type="number"
													min="0"
													step="0.01"
													value={values.pricing.discountAmount}
													onChange={(event) =>
														setField("pricing", {
															...values.pricing,
															discountAmount: Number(event.target.value || 0),
														})
													}
													className="h-12 rounded-2xl"
												/>
											</Field>
											<Field className="rounded-2xl border bg-muted/25 p-4">
												<FieldLabel className="flex items-center justify-between">
													<span>Take deposit</span>
													<Switch
														checked={
															values.pricing.depositRequired ||
															Boolean(selectedBucketRate?.requiresDeposit)
														}
														onCheckedChange={(checked) =>
															setField("pricing", {
																...values.pricing,
																depositRequired: checked,
															})
														}
														disabled={Boolean(
															selectedBucketRate?.requiresDeposit,
														)}
													/>
												</FieldLabel>
												<FieldDescription className="mt-2">
													{selectedBucketRate?.requiresDeposit
														? "This rate already requires a deposit and keeps it attached to the first charge."
														: "Optional deposit added to the first scheduled charge."}
												</FieldDescription>
											</Field>
											<Field>
												<FieldLabel>Deposit amount</FieldLabel>
												<Input
													type="number"
													min="0"
													step="0.01"
													value={values.pricing.depositAmount}
													onChange={(event) =>
														setField("pricing", {
															...values.pricing,
															depositAmount: Number(event.target.value || 0),
														})
													}
													className="h-12 rounded-2xl"
												/>
											</Field>
										</div>

										{values.paymentPlan.kind === "installment" ? (
											<div className="space-y-4 rounded-[24px] border bg-muted/20 p-4">
												<Field>
													<FieldLabel>Installment cadence</FieldLabel>
													<ToggleGroup
														type="single"
														variant="outline"
														size="lg"
														value={schedulePreview.installmentInterval ?? ""}
														onValueChange={(value) => {
															if (value === "week" || value === "month") {
																setField("paymentPlan", {
																	...values.paymentPlan,
																	installmentInterval: value,
																})
															}
														}}
														className="grid w-full grid-cols-2 gap-2 rounded-[24px] bg-background/70 p-1"
													>
														<ToggleGroupItem
															value="week"
															className="h-12 rounded-[18px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
														>
															Weekly
														</ToggleGroupItem>
														<ToggleGroupItem
															value="month"
															className="h-12 rounded-[18px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
														>
															Monthly
														</ToggleGroupItem>
													</ToggleGroup>
													<FieldDescription className="mt-2">
														Default cadence follows the rental duration bucket,
														but you can override it here.
													</FieldDescription>
												</Field>
												<div className="rounded-2xl border bg-background/70 p-4">
													<p className="text-sm font-semibold">
														Recurring billing strategy
													</p>
													<div className="text-muted-foreground mt-3 space-y-2 text-sm">
														<p>
															Cadence:{" "}
															<span className="text-foreground">
																{formatInstallmentIntervalLabel(
																	schedulePreview.installmentInterval,
																)}
															</span>
														</p>
														<p>
															First charge:{" "}
															<span className="text-foreground">
																{formatTimingLabel(
																	values.paymentPlan.firstCollectionTiming,
																)}
															</span>
														</p>
														<p>
															{describeRecurringStartTiming(
																values.paymentPlan.firstCollectionTiming,
															)}
														</p>
													</div>
												</div>
											</div>
										) : null}

										<Field>
											<FieldLabel>Internal notes</FieldLabel>
											<Textarea
												value={values.pricing.notes}
												onChange={(event) =>
													setField("pricing", {
														...values.pricing,
														notes: event.target.value,
													})
												}
												placeholder="Add pickup notes, deposit notes, or internal context."
												rows={5}
												className="rounded-2xl"
											/>
										</Field>
									</div>

									<div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
										<div className="rounded-[28px] border bg-background/95 p-5 sm:p-6">
											<div className="flex items-center justify-between gap-3">
												<p className="text-lg font-semibold">Quote preview</p>
												<Badge
													variant="outline"
													className="rounded-full px-3 py-1"
												>
													{quotePreview.quote
														? formatBucketLabel(
																quotePreview.quote.pricingBucket,
															)
														: "Waiting for dates"}
												</Badge>
											</div>
											{quotePreview.quote ? (
												<div className="mt-4 space-y-4 text-sm">
													<div className="grid grid-cols-2 gap-3">
														<div className="rounded-2xl bg-muted/30 p-3">
															<p className="text-muted-foreground text-xs uppercase">
																Duration
															</p>
															<p className="mt-1 font-semibold">
																{quotePreview.quote.durationDays} days
															</p>
														</div>
														<div className="rounded-2xl bg-muted/30 p-3">
															<p className="text-muted-foreground text-xs uppercase">
																Units
															</p>
															<p className="mt-1 font-semibold">
																{quotePreview.quote.unitCount}
															</p>
														</div>
													</div>
													<div className="rounded-[24px] border bg-primary/6 p-4">
														<p className="text-muted-foreground text-sm">
															Grand total
														</p>
														<p className="mt-1 text-3xl font-semibold">
															{formatCurrency(
																quotePreview.quote.grandTotal,
																"AUD",
															)}
														</p>
													</div>
												</div>
											) : (
												<p className="text-muted-foreground mt-4 text-sm">
													Set the rental dates to calculate pricing.
												</p>
											)}
										</div>

										{quotePreview.error ? (
											<p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
												{quotePreview.error}
											</p>
										) : null}

										{schedulePreview.error ? (
											<p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
												{schedulePreview.error}
											</p>
										) : null}

										{quotePreview.quote ? (
											<>
												<QuoteLineItems
													lineItems={quotePreview.quote.lineItems}
													currency="AUD"
												/>
												<div className="space-y-3 rounded-[28px] border bg-background/95 p-5 sm:p-6">
													<p className="text-base font-semibold">
														Payment schedule preview
													</p>
													<PaymentSchedulePreviewCards
														rows={schedulePreview.rows}
														currency="AUD"
													/>
												</div>
											</>
										) : null}
									</div>
								</div>
							</FieldGroup>
						) : null}

						{step === 4 ? (
							currentDetail ? (
								<FieldGroup className="space-y-6">
									<div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
										<div className="space-y-6 rounded-[28px] border bg-background/90 p-5 sm:p-6">
											<div>
												<p className="text-xl font-semibold">Payment setup</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Choose the collection method, then open the dedicated
													setup drawer for the selected flow.
												</p>
											</div>

											<div className="grid gap-4 lg:grid-cols-3">
												<PaymentMethodCard
													title="Cash"
													description="Record the first collection now or defer it to handover."
													icon={<Banknote className="size-5" />}
													selected={values.payment.methodType === "cash"}
													readyLabel={cashSetupLabel}
													onSelect={() => {
														openPaymentSetup("cash")
													}}
												/>
												<PaymentMethodCard
													title="Card / POS"
													description="Use Stripe Terminal to collect payment or save a card."
													icon={<CreditCard className="size-5" />}
													selected={values.payment.methodType === "card"}
													readyLabel={cardSetupLabel}
													onSelect={() => {
														openPaymentSetup("card")
													}}
												/>
												<PaymentMethodCard
													title="Direct debit"
													description="Prepare an AU BECS debit or save a mandate for later charges."
													icon={<Landmark className="size-5" />}
													selected={
														values.payment.methodType === "au_becs_debit"
													}
													readyLabel={directDebitSetupLabel}
													onSelect={() => {
														openPaymentSetup("au_becs_debit")
													}}
												/>
											</div>

											<div className="rounded-[24px] border bg-muted/20 p-4">
												<p className="text-sm font-semibold">
													What this step does
												</p>
												<ul className="text-muted-foreground mt-3 space-y-2 text-sm">
													<li>
														{formatPaymentPlanLabel(
															currentDetail.rental.paymentPlanKind,
														)}{" "}
														with{" "}
														{formatTimingLabel(
															currentDetail.rental.firstCollectionTiming,
														).toLowerCase()}
														.
													</li>
													<li>
														Future automatic installments require a saved
														payment method before finalization.
													</li>
													{stripeManagedRecurring ? (
														<li>
															Stripe recurring billing will start{" "}
															{currentDetail.rental.firstCollectionTiming ===
															"setup"
																? "after finalize."
																: "during handover."}
														</li>
													) : null}
												</ul>
											</div>

											<Button
												type="button"
												className="h-12 rounded-2xl px-5"
												onClick={() => {
													setActivePaymentSetupDrawer(values.payment.methodType)
												}}
											>
												Open {paymentMethodLabel(values.payment.methodType)}{" "}
												setup
											</Button>
										</div>

										<div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
											<div className="rounded-[28px] border bg-background/95 p-5 sm:p-6">
												<p className="text-lg font-semibold">Draft summary</p>
												<div className="mt-4 space-y-3 text-sm">
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">
															Pricing bucket
														</span>
														<span>
															{formatBucketLabel(
																currentDetail.rental.pricingBucket,
															)}
														</span>
													</div>
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">Plan</span>
														<span>
															{formatPaymentPlanLabel(
																currentDetail.rental.paymentPlanKind,
															)}
														</span>
													</div>
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">
															First charge
														</span>
														<span>
															{formatTimingLabel(
																currentDetail.rental.firstCollectionTiming,
															)}
														</span>
													</div>
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">
															Selected method
														</span>
														<span>
															{currentDetail.rental.selectedPaymentMethodType
																? paymentMethodLabel(
																		currentDetail.rental
																			.selectedPaymentMethodType,
																	)
																: "Not prepared yet"}
														</span>
													</div>
													<div className="flex items-center justify-between gap-3">
														<span className="text-muted-foreground">
															Saved method
														</span>
														<Badge
															variant="outline"
															className={
																currentDetail.rental
																	.selectedPaymentMethodType === "cash"
																	? ""
																	: recurringBillingBadgeClass(
																			currentDetail.rental
																				.recurringBillingState,
																		)
															}
														>
															{currentDetail.rental.storedPaymentMethodStatus.replaceAll(
																"_",
																" ",
															)}
														</Badge>
													</div>
												</div>
											</div>

											{currentDetail.pricingSnapshot ? (
												<>
													<QuoteLineItems
														lineItems={currentDetail.pricingSnapshot.lineItems}
														currency={currentDetail.rental.currency}
													/>
													<div className="space-y-3 rounded-[28px] border bg-background/95 p-5 sm:p-6">
														<p className="text-base font-semibold">Schedule</p>
														<PaymentSchedulePreviewCards
															rows={currentDetail.paymentSchedule}
															currency={currentDetail.rental.currency}
														/>
													</div>
												</>
											) : null}

											{latestPendingPayment ? (
												<div className="rounded-[24px] border p-4 text-sm">
													<p className="font-semibold">Latest Stripe status</p>
													<p className="text-muted-foreground mt-1">
														{latestPendingPayment.status.replaceAll("_", " ")}
													</p>
												</div>
											) : null}
										</div>
									</div>
								</FieldGroup>
							) : (
								<div className="rounded-[28px] border border-dashed bg-background/80 p-6 text-sm text-muted-foreground">
									Save the draft first to continue to payment setup.
								</div>
							)
						) : null}

						{step === 5 ? (
							currentDetail ? (
								<FieldGroup className="space-y-6">
									<div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
										<div className="space-y-6 rounded-[28px] border bg-background/90 p-5 sm:p-6">
											<div>
												<p className="text-xl font-semibold">Rental review</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Review the final summary, capture agreement
													confirmation, and finalize the rental.
												</p>
											</div>

											<div className="grid gap-4 md:grid-cols-2">
												<div className="rounded-[24px] border p-4">
													<p className="text-muted-foreground text-xs uppercase">
														Customer
													</p>
													<p className="mt-1 font-semibold">
														{currentDetail.customer?.fullName ?? "Not set"}
													</p>
													<p className="text-muted-foreground text-sm">
														{currentDetail.customer?.email ??
															currentDetail.customer?.phone ??
															"No contact"}
													</p>
												</div>
												<div className="rounded-[24px] border p-4">
													<p className="text-muted-foreground text-xs uppercase">
														Vehicle
													</p>
													<p className="mt-1 font-semibold">
														{currentDetail.vehicle?.label ?? "Not set"}
													</p>
													<p className="text-muted-foreground text-sm">
														{currentDetail.vehicle?.licensePlate ?? "No plate"}
													</p>
												</div>
												<div className="rounded-[24px] border p-4">
													<p className="text-muted-foreground text-xs uppercase">
														Pickup
													</p>
													<p className="mt-1 font-semibold">
														{formatDateTime(
															currentDetail.rental.plannedStartAt,
														)}
													</p>
												</div>
												<div className="rounded-[24px] border p-4">
													<p className="text-muted-foreground text-xs uppercase">
														Return
													</p>
													<p className="mt-1 font-semibold">
														{formatDateTime(currentDetail.rental.plannedEndAt)}
													</p>
												</div>
											</div>

											{currentDetail.pricingSnapshot ? (
												<>
													<QuoteLineItems
														lineItems={currentDetail.pricingSnapshot.lineItems}
														currency={currentDetail.rental.currency}
													/>
													<PaymentScheduleTable
														rows={currentDetail.paymentSchedule}
														currency={currentDetail.rental.currency}
													/>
												</>
											) : null}

											<div className="rounded-[28px] border bg-muted/20 p-5">
												<p className="text-base font-semibold">Agreement</p>
												<p className="text-muted-foreground mt-1 text-sm">
													The final agreement captures the payment method
													strategy, installment authorization, and deposit
													handling recorded in this draft.
												</p>
												<div className="mt-4 grid gap-4 md:grid-cols-2">
													<Field>
														<FieldLabel>Signer name</FieldLabel>
														<Input
															value={values.agreement.signerName}
															onChange={(event) =>
																setField("agreement", {
																	...values.agreement,
																	signerName: event.target.value,
																})
															}
															className="h-12 rounded-2xl"
														/>
													</Field>
													<Field>
														<FieldLabel>Signature text</FieldLabel>
														<Input
															value={values.agreement.signature}
															onChange={(event) =>
																setField("agreement", {
																	...values.agreement,
																	signature: event.target.value,
																})
															}
															className="h-12 rounded-2xl"
														/>
													</Field>
												</div>
												<label
													htmlFor={agreementAcceptedSwitchId}
													className="mt-4 flex items-start gap-3 rounded-[24px] border bg-background p-4"
												>
													<Switch
														id={agreementAcceptedSwitchId}
														checked={values.agreement.agreementAccepted}
														onCheckedChange={(checked) =>
															setField("agreement", {
																...values.agreement,
																agreementAccepted: checked,
															})
														}
													/>
													<span className="text-sm">
														I confirm the renter accepted the agreement, payment
														terms, and the authorization needed for future
														scheduled collections.
													</span>
												</label>
												{stripeManagedRecurring ? (
													<div className="mt-4 rounded-[24px] border bg-background p-4 text-sm">
														<p className="font-semibold">
															Recurring billing summary
														</p>
														<p className="text-muted-foreground mt-1">
															{paymentMethodLabel(
																currentDetail.rental
																	.selectedPaymentMethodType ?? "card",
															)}{" "}
															will be used for{" "}
															{formatInstallmentIntervalLabel(
																currentDetail.rental.installmentInterval,
															).toLowerCase()}{" "}
															recurring collections.{" "}
															{describeRecurringStartTiming(
																currentDetail.rental.firstCollectionTiming,
															)}
														</p>
													</div>
												) : null}
											</div>
										</div>

										<div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
											<div className="rounded-[28px] border bg-background/95 p-5 sm:p-6">
												<p className="text-lg font-semibold">Finalize state</p>
												<div className="mt-4 space-y-3 text-sm">
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">
															Status after finalize
														</span>
														<span className="capitalize">
															{currentDetail.rental.firstCollectionTiming ===
																"setup" &&
															currentDetail.rental.selectedPaymentMethodType ===
																"au_becs_debit" &&
															firstSchedule &&
															firstSchedule.status !== "succeeded"
																? "awaiting payment"
																: "scheduled"}
														</span>
													</div>
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">
															Payment method
														</span>
														<span>
															{currentDetail.rental.selectedPaymentMethodType
																? paymentMethodLabel(
																		currentDetail.rental
																			.selectedPaymentMethodType,
																	)
																: "Not selected"}
														</span>
													</div>
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">
															Collection timing
														</span>
														<span>
															{formatTimingLabel(
																currentDetail.rental.firstCollectionTiming,
															)}
														</span>
													</div>
													{currentDetail.rental.paymentPlanKind ===
													"installment" ? (
														<>
															<div className="flex items-center justify-between">
																<span className="text-muted-foreground">
																	Installment cadence
																</span>
																<span>
																	{formatInstallmentIntervalLabel(
																		currentDetail.rental.installmentInterval,
																	)}
																</span>
															</div>
															<div className="flex items-center justify-between gap-3">
																<span className="text-muted-foreground">
																	Stripe recurring state
																</span>
																<Badge
																	variant="outline"
																	className={recurringBillingBadgeClass(
																		currentDetail.rental.recurringBillingState,
																	)}
																>
																	{formatRecurringBillingStateLabel(
																		currentDetail.rental.recurringBillingState,
																	)}
																</Badge>
															</div>
														</>
													) : null}
												</div>
											</div>

											{recurringDebugRows.length > 0 ? (
												<div className="rounded-[28px] border bg-background/95 p-5 sm:p-6">
													<p className="text-base font-semibold">
														Stripe references
													</p>
													<div className="mt-4 space-y-3 text-xs">
														{recurringDebugRows.map((row) => (
															<div
																key={`review-${row.id}`}
																className="rounded-4xl border px-4 py-3"
															>
																<p className="font-semibold">
																	#{row.sequence} {row.label}
																</p>
																<p className="text-muted-foreground mt-1">
																	{row.stripeInvoiceId
																		? `Invoice ${row.stripeInvoiceId}`
																		: "Invoice pending"}
																	{row.stripeSubscriptionId
																		? ` • Subscription ${row.stripeSubscriptionId}`
																		: ""}
																</p>
															</div>
														))}
													</div>
												</div>
											) : null}
										</div>
									</div>
								</FieldGroup>
							) : null
						) : null}
					</div>
				</div>

				<DrawerFooter className="shrink-0 border-t bg-background/90 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
					<div className="mx-auto flex w-full max-w-390 flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
						<Button
							type="button"
							variant="outline"
							className="h-12 rounded-2xl px-5"
							onClick={() => {
								if (step === 0) {
									onOpenChange(false)
									return
								}

								setDrawerError(null)
								setStep((current) => Math.max(0, current - 1))
							}}
							disabled={footerBusy}
						>
							{step === 0 ? "Close" : "Back"}
						</Button>

						<div className="flex items-center gap-3">
							<p className="hidden text-sm text-muted-foreground md:block">
								Step {step + 1} of {steps.length}
							</p>
							{step === 5 ? (
								<Button
									type="button"
									className="h-12 rounded-2xl px-6"
									onClick={() => {
										void finalizeRental()
									}}
									disabled={
										footerBusy ||
										!values.agreement.agreementAccepted ||
										!values.agreement.signature.trim()
									}
								>
									{finalizeRentalMutation.isPending
										? "Finalizing..."
										: "Finalize rental"}
								</Button>
							) : (
								<Button
									type="button"
									className="h-12 rounded-2xl px-6"
									onClick={onNext}
									disabled={
										footerBusy ||
										(step === 3 &&
											(!quotePreview.quote ||
												Boolean(quotePreview.error) ||
												Boolean(schedulePreview.error)))
									}
								>
									{footerBusy ? "Working..." : footerPrimaryLabel}
								</Button>
							)}
						</div>
					</div>
				</DrawerFooter>

				<ResponsiveDrawer
					open={activePaymentSetupDrawer === "cash"}
					onOpenChange={(nextOpen) => {
						if (!nextOpen) {
							setActivePaymentSetupDrawer(null)
						}
					}}
					title="Cash collection setup"
					description="Choose whether to record cash now or defer collection to handover."
					desktopClassName="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
				>
					{currentDetail ? (
						<div className="space-y-4">
							<div className="rounded-2xl border p-4">
								<p className="text-sm font-medium">Cash collection</p>
								<p className="text-muted-foreground mt-1 text-sm">
									{currentDetail.rental.firstCollectionTiming === "setup"
										? "Record the first scheduled charge now."
										: "Cash will be collected at handover. This step records the collection strategy."}
								</p>
							</div>
							{currentDetail.rental.firstCollectionTiming === "setup" ? (
								<div className="space-y-3">
									<Field>
										<FieldLabel>Amount tendered by customer</FieldLabel>
										<Input
											type="number"
											min="0"
											step="0.01"
											value={values.payment.amountTendered}
											onChange={(event) =>
												setField("payment", {
													...values.payment,
													amountTendered: event.target.value,
												})
											}
											className="h-12 rounded-2xl"
										/>
									</Field>
									<Button
										type="button"
										className="h-12 rounded-2xl"
										onClick={() => {
											void collectCash()
										}}
										disabled={
											collectCashPaymentMutation.isPending ||
											firstSchedule?.status === "succeeded"
										}
									>
										{collectCashPaymentMutation.isPending
											? "Recording cash..."
											: firstSchedule?.status === "succeeded"
												? "Cash already collected"
												: "Mark cash as collected"}
									</Button>
								</div>
							) : (
								<Button
									type="button"
									className="h-12 rounded-2xl"
									onClick={() => {
										void preparePayment("cash")
									}}
									disabled={preparePaymentMutation.isPending}
								>
									{preparePaymentMutation.isPending
										? "Saving strategy..."
										: "Save cash collection for handover"}
								</Button>
							)}
						</div>
					) : null}
				</ResponsiveDrawer>

				<ResponsiveDrawer
					open={activePaymentSetupDrawer === "card"}
					onOpenChange={(nextOpen) => {
						if (!nextOpen) {
							setActivePaymentSetupDrawer(null)
						}
					}}
					title="Card / POS setup"
					description="Prepare the Stripe Terminal flow, then send the action to a reader."
					desktopClassName="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
				>
					{currentDetail ? (
						<div className="space-y-4">
							<div className="rounded-2xl border p-4">
								<p className="text-sm font-medium">Stripe Terminal</p>
								<p className="text-muted-foreground mt-1 text-sm">
									Prepare the terminal payment or saved-card setup first, then
									send the action to a reader.
								</p>
								<Button
									type="button"
									className="mt-4 h-12 rounded-2xl"
									onClick={() => {
										void preparePayment("card")
									}}
									disabled={preparePaymentMutation.isPending}
								>
									{preparePaymentMutation.isPending
										? "Preparing terminal..."
										: "Prepare terminal flow"}
								</Button>
							</div>
							<RentalPaymentTerminalPanel
								rentalId={draftRentalId ?? currentDetail.rental.id}
								payments={currentDetail.payments}
							/>
							<div className="flex justify-end">
								<Button
									type="button"
									variant="outline"
									className="rounded-2xl"
									onClick={() => {
										void rentalDraftQuery.refetch()
									}}
								>
									Refresh payment status
								</Button>
							</div>
						</div>
					) : null}
				</ResponsiveDrawer>

				<ResponsiveDrawer
					open={activePaymentSetupDrawer === "au_becs_debit"}
					onOpenChange={(nextOpen) => {
						if (!nextOpen) {
							setActivePaymentSetupDrawer(null)
						}
					}}
					title="Direct debit setup"
					description="Prepare the AU BECS debit or mandate and complete the confirmation flow."
					desktopClassName="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
				>
					{currentDetail ? (
						<div className="space-y-4">
							<div className="rounded-2xl border p-4">
								<p className="text-sm font-medium">Direct debit setup</p>
								<p className="text-muted-foreground mt-1 text-sm">
									Create the AU BECS debit intent or mandate first, then
									complete it below.
								</p>
								<Button
									type="button"
									className="mt-4 h-12 rounded-2xl"
									onClick={() => {
										void preparePayment("au_becs_debit")
									}}
									disabled={preparePaymentMutation.isPending}
								>
									{preparePaymentMutation.isPending
										? "Preparing direct debit..."
										: "Prepare direct debit flow"}
								</Button>
							</div>
							{paymentSession?.collectionSurface === "direct_debit" ? (
								<RentalPaymentAuBecsForm
									rentalId={draftRentalId ?? currentDetail.rental.id}
									paymentSession={paymentSession}
									customerName={currentDetail.customer?.fullName ?? ""}
									customerEmail={currentDetail.customer?.email ?? ""}
									onConfirmed={() => {
										setPaymentSession(null)
										void rentalDraftQuery.refetch()
									}}
								/>
							) : null}
						</div>
					) : null}
				</ResponsiveDrawer>
			</DrawerContent>
		</Drawer>
	)
}
