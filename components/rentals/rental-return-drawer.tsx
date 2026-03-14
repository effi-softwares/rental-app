"use client"

import {
	AlertCircle,
	ArrowRight,
	Banknote,
	Camera,
	CheckCircle2,
	CreditCard,
	FileText,
	LoaderCircle,
	ShieldCheck,
	Trash2,
	Wallet,
	Wrench,
} from "lucide-react"
import type { Dispatch, ReactNode, SetStateAction } from "react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { MediaImage } from "@/components/media/media-image"
import { MediaUploader } from "@/components/media/media-uploader"
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
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import { Textarea } from "@/components/ui/textarea"
import {
	type RentalChargeKind,
	type RentalChargeSummary,
	type RentalDamageCategory,
	type RentalDamageSeverity,
	type RentalDetailResponse,
	type RentalInspectionCleanliness,
	type RentalPaymentSession,
	useCollectCashPaymentMutation,
	useCollectRentalChargeMutation,
	useCreateRentalChargeMutation,
	usePrepareRentalPaymentMutation,
	useResolveRentalDepositMutation,
	useReturnRentalMutation,
	useSaveRentalInspectionMutation,
	useUpdateRentalChargeMutation,
} from "@/features/rentals"
import { resolveErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { RentalPaymentAuBecsForm } from "./rental-payment-au-becs-form"
import { RentalPaymentTerminalPanel } from "./rental-payment-terminal-panel"

type RentalReturnDrawerProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	rentalId: string
	detail: RentalDetailResponse
	onUpdated?: () => Promise<unknown> | undefined
}

type UploadedMediaItem = {
	assetId: string
	deliveryUrl: string
	blurDataUrl: string
	label: string | null
}

type ReturnDamageDraft = {
	id: string
	persistedChargeId: string | null
	category: RentalDamageCategory
	title: string
	description: string
	severity: RentalDamageSeverity
	estimatedCost: string
	actualCost: string
	customerLiabilityAmount: string
	media: UploadedMediaItem[]
}

type ReturnExpenseDraft = {
	id: string
	persistedChargeId: string | null
	kind: Exclude<RentalChargeKind, "damage" | "extension">
	amount: string
	taxAmount: string
	description: string
	dueAt: string
}

const returnSteps = [
	{
		title: "Check-in",
		description: "Record how the vehicle came back.",
	},
	{
		title: "Photos",
		description: "Capture clear evidence before anyone leaves.",
	},
	{
		title: "Damage & expenses",
		description: "Add issues, fees, and extra costs once.",
	},
	{
		title: "Settle balance",
		description: "Collect anything that is still due now.",
	},
	{
		title: "Deposit & finish",
		description: "Resolve the deposit and complete the return.",
	},
] as const

function createDraftId() {
	return Math.random().toString(36).slice(2, 10)
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

function toDatetimeInputValue(value: string | null) {
	if (!value) {
		return ""
	}

	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return ""
	}

	return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
		.toISOString()
		.slice(0, 16)
}

function toIsoOrNull(value: string) {
	if (!value.trim()) {
		return null
	}

	const parsed = new Date(value)
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function toOptionalNumber(value: string) {
	if (!value.trim()) {
		return null
	}

	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

function parsePhotoGroups(
	detail: RentalDetailResponse,
): Record<
	"exterior" | "interior" | "dashboard" | "additional",
	UploadedMediaItem[]
> {
	const returnInspection =
		detail.inspections.find((inspection) => inspection.stage === "return") ??
		null

	const groups = {
		exterior: [] as UploadedMediaItem[],
		interior: [] as UploadedMediaItem[],
		dashboard: [] as UploadedMediaItem[],
		additional: [] as UploadedMediaItem[],
	}

	for (const item of returnInspection?.media ?? []) {
		const asset = {
			assetId: item.assetId,
			deliveryUrl: item.deliveryUrl,
			blurDataUrl: item.blurDataUrl ?? "",
			label: item.label,
		}

		if (item.label?.startsWith("Exterior")) {
			groups.exterior.push(asset)
			continue
		}

		if (item.label?.startsWith("Interior")) {
			groups.interior.push(asset)
			continue
		}

		if (item.label?.startsWith("Dashboard")) {
			groups.dashboard.push(asset)
			continue
		}

		groups.additional.push(asset)
	}

	return groups
}

function getReturnDamageDrafts(
	detail: RentalDetailResponse,
): ReturnDamageDraft[] {
	const returnInspection =
		detail.inspections.find((inspection) => inspection.stage === "return") ??
		null

	const chargeByDamageId = new Map(
		detail.extraCharges
			.filter(
				(charge) => charge.linkedDamageId && charge.status !== "cancelled",
			)
			.map((charge) => [charge.linkedDamageId, charge] as const),
	)

	return detail.damages
		.filter((damage) => damage.inspectionId === returnInspection?.id)
		.map((damage) => ({
			id: createDraftId(),
			persistedChargeId: chargeByDamageId.get(damage.id)?.id ?? null,
			category: damage.category,
			title: damage.title,
			description: damage.description ?? "",
			severity: damage.severity,
			estimatedCost:
				damage.estimatedCost !== null ? String(damage.estimatedCost) : "",
			actualCost: damage.actualCost !== null ? String(damage.actualCost) : "",
			customerLiabilityAmount: String(damage.customerLiabilityAmount ?? 0),
			media: damage.media.map((item) => ({
				assetId: item.assetId,
				deliveryUrl: item.deliveryUrl,
				blurDataUrl: item.blurDataUrl ?? "",
				label: item.label,
			})),
		}))
}

function getReturnExpenseDrafts(
	detail: RentalDetailResponse,
): ReturnExpenseDraft[] {
	return detail.extraCharges
		.filter((charge) => {
			if (charge.status === "cancelled" || charge.kind === "damage") {
				return false
			}

			return (
				charge.metadata?.source === "return_flow" &&
				charge.metadata?.entryType === "expense"
			)
		})
		.map((charge) => ({
			id: createDraftId(),
			persistedChargeId: charge.id,
			kind: (charge.kind === "damage" || charge.kind === "extension"
				? "other"
				: charge.kind) as ReturnExpenseDraft["kind"],
			amount: String(charge.amount),
			taxAmount: String(charge.taxAmount),
			description: charge.description ?? "",
			dueAt: toDatetimeInputValue(charge.dueAt),
		}))
}

function buildDefaultActualEndAt(detail: RentalDetailResponse) {
	return toDatetimeInputValue(
		detail.rental.actualEndAt ??
			detail.rental.plannedEndAt ??
			new Date().toISOString(),
	)
}

function buildDefaultDepositAmount(detail: RentalDetailResponse) {
	return detail.financials.depositHeld > 0
		? String(detail.financials.depositHeld)
		: ""
}

function buildDefaultScheduleCashAmounts(detail: RentalDetailResponse) {
	return Object.fromEntries(
		detail.paymentSchedule
			.filter((row) => row.status !== "succeeded" && row.status !== "cancelled")
			.map((row) => [row.id, String(row.amount)]),
	)
}

function buildOpenCharges(detail: RentalDetailResponse) {
	return detail.extraCharges.filter(
		(charge) => charge.status === "open" || charge.status === "partially_paid",
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
				"min-w-[220px] rounded-[24px] border px-4 py-4 transition md:min-w-0",
				active && "border-primary bg-primary/[0.08] shadow-sm",
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

function SectionNote({
	icon,
	title,
	description,
}: {
	icon: ReactNode
	title: string
	description: string
}) {
	return (
		<div className="flex gap-3 rounded-2xl border bg-muted/20 p-4">
			<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background">
				{icon}
			</div>
			<div className="space-y-1">
				<p className="text-sm font-semibold">{title}</p>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
		</div>
	)
}

function FormField({
	label,
	children,
}: {
	label: string
	children: ReactNode
}) {
	return (
		<div className="space-y-2">
			<span className="text-sm font-medium">{label}</span>
			{children}
		</div>
	)
}

function MediaPreviewGrid({
	items,
	onRemove,
}: {
	items: UploadedMediaItem[]
	onRemove: (assetId: string) => void
}) {
	if (items.length === 0) {
		return (
			<div className="rounded-2xl border border-dashed p-4">
				<p className="text-muted-foreground text-sm">No photos added yet.</p>
			</div>
		)
	}

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{items.map((item) => (
				<div key={item.assetId} className="overflow-hidden rounded-2xl border">
					<div className="relative aspect-[4/3] bg-muted">
						<MediaImage
							fill
							asset={{
								id: item.assetId,
								deliveryUrl: item.deliveryUrl,
								visibility: "private",
								blurDataUrl: item.blurDataUrl || null,
								originalFileName: item.label ?? "Vehicle photo",
								contentType: "image/jpeg",
							}}
							alt={item.label ?? "Vehicle photo"}
						/>
					</div>
					<div className="flex items-center justify-between gap-2 px-3 py-2">
						<p className="truncate text-sm font-medium">
							{item.label ?? "Uploaded photo"}
						</p>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => {
								onRemove(item.assetId)
							}}
						>
							<Trash2 className="size-4" />
						</Button>
					</div>
				</div>
			))}
		</div>
	)
}

export function RentalReturnDrawer({
	open,
	onOpenChange,
	rentalId,
	detail,
	onUpdated,
}: RentalReturnDrawerProps) {
	const saveInspectionMutation = useSaveRentalInspectionMutation()
	const createChargeMutation = useCreateRentalChargeMutation()
	const updateChargeMutation = useUpdateRentalChargeMutation()
	const collectCashMutation = useCollectCashPaymentMutation()
	const preparePaymentMutation = usePrepareRentalPaymentMutation()
	const collectChargeMutation = useCollectRentalChargeMutation()
	const resolveDepositMutation = useResolveRentalDepositMutation()
	const returnMutation = useReturnRentalMutation()

	const [step, setStep] = useState(0)
	const [actualEndAt, setActualEndAt] = useState("")
	const [returnOdometer, setReturnOdometer] = useState("")
	const [returnFuelPercent, setReturnFuelPercent] = useState("")
	const [cleanliness, setCleanliness] =
		useState<RentalInspectionCleanliness>("clean")
	const [staffNotes, setStaffNotes] = useState("")
	const [checklist, setChecklist] = useState<Record<string, boolean>>({
		exteriorChecked: true,
		interiorChecked: true,
		keysReceived: true,
	})
	const [exteriorPhotos, setExteriorPhotos] = useState<UploadedMediaItem[]>([])
	const [interiorPhotos, setInteriorPhotos] = useState<UploadedMediaItem[]>([])
	const [dashboardPhotos, setDashboardPhotos] = useState<UploadedMediaItem[]>(
		[],
	)
	const [additionalPhotos, setAdditionalPhotos] = useState<UploadedMediaItem[]>(
		[],
	)
	const [damageDrafts, setDamageDrafts] = useState<ReturnDamageDraft[]>([])
	const [expenseDrafts, setExpenseDrafts] = useState<ReturnExpenseDraft[]>([])
	const [removedChargeIds, setRemovedChargeIds] = useState<string[]>([])
	const [scheduleCashAmounts, setScheduleCashAmounts] = useState<
		Record<string, string>
	>({})
	const [chargeCashAmounts, setChargeCashAmounts] = useState<
		Record<string, string>
	>({})
	const [paymentSession, setPaymentSession] =
		useState<RentalPaymentSession | null>(null)
	const [depositAction, setDepositAction] = useState<
		"release" | "refund" | "retain" | "apply_to_charge"
	>("release")
	const [depositAmount, setDepositAmount] = useState("")
	const [depositChargeId, setDepositChargeId] = useState("")
	const [depositNote, setDepositNote] = useState("")
	const [completionNotes, setCompletionNotes] = useState("")
	const [isSavingStep, setIsSavingStep] = useState(false)
	const [initializedForOpen, setInitializedForOpen] = useState(false)

	useEffect(() => {
		if (!open) {
			setInitializedForOpen(false)
			return
		}

		if (initializedForOpen) {
			return
		}

		const photoGroups = parsePhotoGroups(detail)
		const returnInspection =
			detail.inspections.find((inspection) => inspection.stage === "return") ??
			null

		setStep(0)
		setActualEndAt(buildDefaultActualEndAt(detail))
		setReturnOdometer(
			returnInspection?.odometerKm !== null &&
				returnInspection?.odometerKm !== undefined
				? String(returnInspection.odometerKm)
				: "",
		)
		setReturnFuelPercent(
			returnInspection?.fuelPercent !== null &&
				returnInspection?.fuelPercent !== undefined
				? String(returnInspection.fuelPercent)
				: "",
		)
		setCleanliness(returnInspection?.cleanliness ?? "clean")
		setStaffNotes(returnInspection?.notes ?? "")
		setChecklist({
			exteriorChecked: returnInspection?.checklist.exteriorChecked ?? true,
			interiorChecked: returnInspection?.checklist.interiorChecked ?? true,
			keysReceived: returnInspection?.checklist.keysReceived ?? true,
		})
		setExteriorPhotos(photoGroups.exterior)
		setInteriorPhotos(photoGroups.interior)
		setDashboardPhotos(photoGroups.dashboard)
		setAdditionalPhotos(photoGroups.additional)
		setDamageDrafts(getReturnDamageDrafts(detail))
		setExpenseDrafts(getReturnExpenseDrafts(detail))
		setRemovedChargeIds([])
		setScheduleCashAmounts(buildDefaultScheduleCashAmounts(detail))
		setChargeCashAmounts({})
		setPaymentSession(null)
		setDepositAction("release")
		setDepositAmount(buildDefaultDepositAmount(detail))
		setDepositChargeId("")
		setDepositNote("")
		setCompletionNotes("")
		setInitializedForOpen(true)
	}, [detail, initializedForOpen, open])

	const openScheduleRows = useMemo(
		() =>
			detail.paymentSchedule.filter(
				(row) => row.status !== "succeeded" && row.status !== "cancelled",
			),
		[detail.paymentSchedule],
	)
	const openChargeRows = useMemo(() => buildOpenCharges(detail), [detail])
	const dueNowTotal =
		detail.financials.scheduledOutstanding +
		detail.financials.extraChargesOutstanding
	const hasRequiredPhotos =
		exteriorPhotos.length > 0 &&
		interiorPhotos.length > 0 &&
		dashboardPhotos.length > 0

	const stepCompleted = [
		Boolean(actualEndAt),
		hasRequiredPhotos,
		detail.actionState.hasReturnInspection || step > 2,
		dueNowTotal <= 0.009,
		detail.actionState.canCompleteReturn,
	]

	async function refreshDetail() {
		await onUpdated?.()
	}

	function appendUploadedMedia(
		setter: Dispatch<SetStateAction<UploadedMediaItem[]>>,
		label: string,
		replace = false,
	) {
		return (
			result: Array<{
				assetId: string
				url: string
				deliveryUrl: string
				blurDataUrl: string | null
			}>,
		) => {
			const mapped = result.map((item) => ({
				assetId: item.assetId,
				deliveryUrl: item.deliveryUrl,
				blurDataUrl: item.blurDataUrl ?? "",
				label,
			}))

			setter((current) => (replace ? mapped : [...current, ...mapped]))
			toast.success("Photo added.")
		}
	}

	function removePhoto(
		setter: Dispatch<SetStateAction<UploadedMediaItem[]>>,
		assetId: string,
	) {
		setter((current) => current.filter((item) => item.assetId !== assetId))
	}

	function addDamageDraft() {
		setDamageDrafts((current) => [
			...current,
			{
				id: createDraftId(),
				persistedChargeId: null,
				category: "exterior",
				title: "",
				description: "",
				severity: "minor",
				estimatedCost: "",
				actualCost: "",
				customerLiabilityAmount: "",
				media: [],
			},
		])
	}

	function addExpenseDraft() {
		setExpenseDrafts((current) => [
			...current,
			{
				id: createDraftId(),
				persistedChargeId: null,
				kind: "cleaning",
				amount: "",
				taxAmount: "",
				description: "",
				dueAt: "",
			},
		])
	}

	function validateWorkBeforeSave() {
		if (!actualEndAt.trim() || !toIsoOrNull(actualEndAt)) {
			toast.error("Add the actual return time before continuing.")
			return false
		}

		if (!hasRequiredPhotos) {
			toast.error(
				"Add exterior, interior, and dashboard photos before continuing.",
			)
			return false
		}

		for (const [index, damage] of damageDrafts.entries()) {
			if (!damage.title.trim()) {
				toast.error(`Damage item ${index + 1} needs a short title.`)
				return false
			}
			if (
				damage.customerLiabilityAmount.trim() &&
				toOptionalNumber(damage.customerLiabilityAmount) === null
			) {
				toast.error(`Damage item ${index + 1} has an invalid liability amount.`)
				return false
			}
		}

		for (const [index, expense] of expenseDrafts.entries()) {
			const amount = toOptionalNumber(expense.amount)
			if (amount === null || amount <= 0) {
				toast.error(`Expense item ${index + 1} needs a valid amount.`)
				return false
			}
		}

		return true
	}

	async function persistReturnWork() {
		if (!validateWorkBeforeSave()) {
			return false
		}

		setIsSavingStep(true)

		try {
			const inspectionResult = await saveInspectionMutation.mutateAsync({
				rentalId,
				stage: "return",
				payload: {
					stage: "return",
					odometerKm: toOptionalNumber(returnOdometer),
					fuelPercent: toOptionalNumber(returnFuelPercent),
					cleanliness,
					checklist,
					notes: staffNotes.trim(),
					media: [
						...exteriorPhotos.map((item, index) => ({
							assetId: item.assetId,
							deliveryUrl: item.deliveryUrl,
							blurDataUrl: item.blurDataUrl,
							label: `Exterior ${index + 1}`,
						})),
						...interiorPhotos.map((item, index) => ({
							assetId: item.assetId,
							deliveryUrl: item.deliveryUrl,
							blurDataUrl: item.blurDataUrl,
							label: `Interior ${index + 1}`,
						})),
						...dashboardPhotos.map((item, index) => ({
							assetId: item.assetId,
							deliveryUrl: item.deliveryUrl,
							blurDataUrl: item.blurDataUrl,
							label: `Dashboard ${index + 1}`,
						})),
						...additionalPhotos.map((item, index) => ({
							assetId: item.assetId,
							deliveryUrl: item.deliveryUrl,
							blurDataUrl: item.blurDataUrl,
							label: item.label ?? `Additional ${index + 1}`,
						})),
					],
					damages: damageDrafts.map((damage) => ({
						category: damage.category,
						title: damage.title.trim(),
						description: damage.description.trim(),
						severity: damage.severity,
						customerLiabilityAmount:
							toOptionalNumber(damage.customerLiabilityAmount) ?? 0,
						estimatedCost: toOptionalNumber(damage.estimatedCost),
						actualCost: toOptionalNumber(damage.actualCost),
						occurredAt: toIsoOrNull(actualEndAt),
						media: damage.media.map((item, index) => ({
							assetId: item.assetId,
							deliveryUrl: item.deliveryUrl,
							blurDataUrl: item.blurDataUrl,
							label: item.label ?? `Damage ${index + 1}`,
						})),
					})),
				},
			})

			for (const chargeId of removedChargeIds) {
				await updateChargeMutation.mutateAsync({
					rentalId,
					chargeId,
					payload: {
						status: "cancelled",
					},
				})
			}

			for (const expense of expenseDrafts) {
				const payload = {
					kind: expense.kind,
					amount: toOptionalNumber(expense.amount) ?? 0,
					taxAmount: toOptionalNumber(expense.taxAmount) ?? 0,
					description: expense.description.trim(),
					dueAt: toIsoOrNull(expense.dueAt),
					metadata: {
						source: "return_flow",
						entryType: "expense",
						draftId: expense.id,
					},
				}

				if (expense.persistedChargeId) {
					await updateChargeMutation.mutateAsync({
						rentalId,
						chargeId: expense.persistedChargeId,
						payload,
					})
					continue
				}

				await createChargeMutation.mutateAsync({
					rentalId,
					payload,
				})
			}

			for (const [index, damage] of damageDrafts.entries()) {
				const liabilityAmount =
					toOptionalNumber(damage.customerLiabilityAmount) ?? 0

				if (liabilityAmount <= 0) {
					if (damage.persistedChargeId) {
						await updateChargeMutation.mutateAsync({
							rentalId,
							chargeId: damage.persistedChargeId,
							payload: {
								status: "cancelled",
							},
						})
					}
					continue
				}

				const linkedDamageId = inspectionResult.damages[index]?.id ?? null
				const payload = {
					kind: "damage" as const,
					amount: liabilityAmount,
					taxAmount: 0,
					description: damage.title.trim(),
					linkedDamageId,
					metadata: {
						source: "return_flow",
						entryType: "damage",
						draftId: damage.id,
					},
				}

				if (damage.persistedChargeId) {
					await updateChargeMutation.mutateAsync({
						rentalId,
						chargeId: damage.persistedChargeId,
						payload,
					})
					continue
				}

				await createChargeMutation.mutateAsync({
					rentalId,
					payload,
				})
			}

			setRemovedChargeIds([])
			await refreshDetail()
			toast.success("Return details saved. You can settle the balance next.")
			return true
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to save return details."))
			return false
		} finally {
			setIsSavingStep(false)
		}
	}

	async function handleCollectScheduleCash(scheduleId: string) {
		const amount = toOptionalNumber(scheduleCashAmounts[scheduleId] ?? "")
		if (amount === null || amount <= 0) {
			toast.error("Enter the cash amount received for this payment.")
			return
		}

		try {
			const result = await collectCashMutation.mutateAsync({
				rentalId,
				payload: {
					scheduleId,
					amountTendered: amount,
				},
			})
			await refreshDetail()
			toast.success(
				result.changeDue > 0
					? `Payment collected. Change due: ${formatCurrency(result.changeDue, detail.deposit.currency)}.`
					: "Payment collected.",
			)
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to collect cash payment."))
		}
	}

	async function handlePrepareSchedulePayment(
		scheduleId: string,
		paymentMethodType: "card" | "au_becs_debit",
	) {
		try {
			const result = await preparePaymentMutation.mutateAsync({
				rentalId,
				payload: {
					paymentMethodType,
					scheduleId,
				},
			})
			setPaymentSession(result.paymentSession)
			await refreshDetail()
			toast.success(
				paymentMethodType === "card"
					? "Card collection is ready."
					: "Direct debit flow is ready.",
			)
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to prepare payment."))
		}
	}

	async function handleCollectCharge(
		charge: RentalChargeSummary,
		method: "cash" | "card",
	) {
		const cashAmount = toOptionalNumber(chargeCashAmounts[charge.id] ?? "")
		if (method === "cash" && (cashAmount === null || cashAmount <= 0)) {
			toast.error("Enter the cash amount received for this charge.")
			return
		}

		try {
			await collectChargeMutation.mutateAsync({
				rentalId,
				chargeId: charge.id,
				payload: {
					paymentMethodType: method,
					amountTendered:
						method === "cash" ? (cashAmount ?? undefined) : undefined,
				},
			})
			await refreshDetail()
			toast.success(
				method === "cash"
					? "Charge collected in cash."
					: "Charge marked as paid by card.",
			)
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to collect charge."))
		}
	}

	async function handleResolveDeposit() {
		const amount = toOptionalNumber(depositAmount)
		if (amount === null || amount <= 0) {
			toast.error("Enter a valid deposit amount.")
			return
		}

		if (depositAction === "apply_to_charge" && !depositChargeId) {
			toast.error("Choose which open charge should receive the deposit.")
			return
		}

		try {
			await resolveDepositMutation.mutateAsync({
				rentalId,
				payload:
					depositAction === "apply_to_charge"
						? {
								action: "apply_to_charge",
								amount,
								chargeId: depositChargeId,
								note: depositNote.trim(),
							}
						: {
								action: depositAction,
								amount,
								note: depositNote.trim(),
							},
			})
			await refreshDetail()
			setDepositAmount("")
			setDepositChargeId("")
			setDepositNote("")
			toast.success("Deposit updated.")
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to update the deposit."))
		}
	}

	async function handleCompleteReturn() {
		const actualEndAtIso = toIsoOrNull(actualEndAt)
		if (!actualEndAtIso) {
			toast.error("Add a valid actual return time first.")
			return
		}

		try {
			await returnMutation.mutateAsync({
				rentalId,
				payload: {
					actualEndAt: actualEndAtIso,
					notes: completionNotes.trim(),
				},
			})
			await refreshDetail()
			toast.success("Rental return completed.")
			onOpenChange(false)
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to complete the return."))
		}
	}

	async function handleNext() {
		if (step === 0) {
			if (!actualEndAt.trim() || !toIsoOrNull(actualEndAt)) {
				toast.error("Add the actual return time to continue.")
				return
			}
			setStep(1)
			return
		}

		if (step === 1) {
			if (!hasRequiredPhotos) {
				toast.error(
					"Add exterior, interior, and dashboard photos before continuing.",
				)
				return
			}
			setStep(2)
			return
		}

		if (step === 2) {
			const saved = await persistReturnWork()
			if (saved) {
				setStep(3)
			}
			return
		}

		if (step === 3) {
			if (dueNowTotal > 0.009) {
				toast.error("Collect the remaining balance before moving to finish.")
				return
			}
			setStep(4)
		}
	}

	function renderCheckInStep() {
		return (
			<div className="space-y-5">
				<SectionNote
					icon={<FileText className="size-4" />}
					title="Start with the real handback details"
					description="These details anchor the rest of the return. Staff should be able to understand when the vehicle came back and what condition it was in."
				/>

				<div className="grid gap-4 lg:grid-cols-2">
					<Card className="border-border/70">
						<CardHeader>
							<CardTitle>Return details</CardTitle>
							<CardDescription>
								Add the actual time, odometer, fuel, and a short note for the
								team.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<FormField label="Actual return time">
									<Input
										type="datetime-local"
										value={actualEndAt}
										onChange={(event) => {
											setActualEndAt(event.target.value)
										}}
									/>
								</FormField>
								<FormField label="Cleanliness">
									<select
										className="h-10 w-full rounded-md border bg-background px-3 text-sm"
										value={cleanliness}
										onChange={(event) => {
											setCleanliness(
												event.target.value as RentalInspectionCleanliness,
											)
										}}
									>
										<option value="clean">Clean</option>
										<option value="needs_attention">Needs attention</option>
										<option value="dirty">Dirty</option>
									</select>
								</FormField>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<FormField label="Odometer (km)">
									<Input
										value={returnOdometer}
										onChange={(event) => {
											setReturnOdometer(event.target.value)
										}}
										placeholder="e.g. 54210"
									/>
								</FormField>
								<FormField label="Fuel (%)">
									<Input
										value={returnFuelPercent}
										onChange={(event) => {
											setReturnFuelPercent(event.target.value)
										}}
										placeholder="e.g. 50"
									/>
								</FormField>
							</div>
							<FormField label="Staff notes">
								<Textarea
									value={staffNotes}
									onChange={(event) => {
										setStaffNotes(event.target.value)
									}}
									placeholder="Anything the next team should know about this return."
								/>
							</FormField>
						</CardContent>
					</Card>

					<Card className="border-border/70">
						<CardHeader>
							<CardTitle>Quick checks</CardTitle>
							<CardDescription>
								These simple checks help the next person understand what was
								confirmed at handback.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{[
								{
									key: "exteriorChecked",
									label: "Exterior checked",
								},
								{
									key: "interiorChecked",
									label: "Interior checked",
								},
								{
									key: "keysReceived",
									label: "Keys received",
								},
							].map((item) => (
								<label
									key={item.key}
									className="flex items-center justify-between rounded-2xl border px-4 py-3"
								>
									<span className="text-sm font-medium">{item.label}</span>
									<input
										type="checkbox"
										checked={Boolean(checklist[item.key])}
										onChange={(event) => {
											setChecklist((current) => ({
												...current,
												[item.key]: event.target.checked,
											}))
										}}
									/>
								</label>
							))}
							<div className="rounded-2xl border bg-muted/20 p-4">
								<p className="text-sm font-medium">Why this matters</p>
								<p className="text-muted-foreground mt-1 text-sm">
									Simple, clear wording helps branch staff move faster and avoid
									missing something important when the customer is waiting.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		)
	}

	function renderPhotosStep() {
		return (
			<div className="space-y-5">
				<SectionNote
					icon={<Camera className="size-4" />}
					title="Capture the essential evidence first"
					description="At least one exterior, one interior, and one dashboard photo are required. This makes disputes easier to handle later."
				/>

				<div className="grid gap-4">
					{[
						{
							title: "Exterior overview",
							description: "Show the outside of the vehicle clearly.",
							field: "return-exterior",
							items: exteriorPhotos,
							setter: setExteriorPhotos,
							required: true,
							label: "Exterior overview",
						},
						{
							title: "Interior overview",
							description: "Capture seats, cabin, and visible wear inside.",
							field: "return-interior",
							items: interiorPhotos,
							setter: setInteriorPhotos,
							required: true,
							label: "Interior overview",
						},
						{
							title: "Dashboard / odometer / fuel",
							description:
								"Show the dashboard so mileage and fuel can be verified.",
							field: "return-dashboard",
							items: dashboardPhotos,
							setter: setDashboardPhotos,
							required: true,
							label: "Dashboard / odometer / fuel",
						},
						{
							title: "Additional photos",
							description:
								"Add anything else that helps explain the condition.",
							field: "return-additional",
							items: additionalPhotos,
							setter: setAdditionalPhotos,
							required: false,
							label: "Additional photo",
						},
					].map((group) => (
						<Card key={group.field} className="border-border/70">
							<CardHeader>
								<div className="flex flex-wrap items-center gap-2">
									<CardTitle>{group.title}</CardTitle>
									{group.required ? (
										<Badge variant="outline">Required</Badge>
									) : null}
								</div>
								<CardDescription>{group.description}</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<MediaUploader
									entityType="rental-return"
									entityId={rentalId}
									handleUploadUrl={`/api/rentals/${rentalId}/media/upload`}
									finalizeUrl={`/api/rentals/${rentalId}/media/finalize`}
									field={group.field}
									branchId={detail.branch?.id ?? null}
									metadata={{
										rentalId,
										source: "return_flow",
										group: group.field,
									}}
									onUploaded={appendUploadedMedia(
										group.setter,
										group.label,
										!group.field.includes("additional"),
									)}
								/>
								<MediaPreviewGrid
									items={group.items}
									onRemove={(assetId) => {
										removePhoto(group.setter, assetId)
									}}
								/>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		)
	}

	function renderDamageAndExpensesStep() {
		return (
			<div className="space-y-5">
				<SectionNote
					icon={<Wrench className="size-4" />}
					title="Add issues and costs once"
					description="Use clear titles and amounts so the next step only focuses on collecting what is due."
				/>

				<div className="grid gap-4 xl:grid-cols-2">
					<Card className="border-border/70">
						<CardHeader>
							<div className="flex items-center justify-between gap-3">
								<div>
									<CardTitle>Damage items</CardTitle>
									<CardDescription>
										Record each issue separately so photos and liability stay
										easy to understand.
									</CardDescription>
								</div>
								<Button
									type="button"
									variant="outline"
									onClick={addDamageDraft}
								>
									Add damage
								</Button>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							{damageDrafts.length === 0 ? (
								<div className="rounded-2xl border border-dashed p-4">
									<p className="text-muted-foreground text-sm">
										No damage items added. Continue if the vehicle came back in
										good condition.
									</p>
								</div>
							) : null}

							{damageDrafts.map((draft, index) => (
								<div
									key={draft.id}
									className="space-y-4 rounded-2xl border p-4"
								>
									<div className="flex items-center justify-between gap-2">
										<p className="font-medium">Damage item {index + 1}</p>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onClick={() => {
												if (draft.persistedChargeId) {
													setRemovedChargeIds((current) => [
														...current,
														draft.persistedChargeId as string,
													])
												}
												setDamageDrafts((current) =>
													current.filter((item) => item.id !== draft.id),
												)
											}}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<FormField label="Category">
											<select
												className="h-10 w-full rounded-md border bg-background px-3 text-sm"
												value={draft.category}
												onChange={(event) => {
													setDamageDrafts((current) =>
														current.map((item) =>
															item.id === draft.id
																? {
																		...item,
																		category: event.target
																			.value as RentalDamageCategory,
																	}
																: item,
														),
													)
												}}
											>
												<option value="exterior">Exterior</option>
												<option value="interior">Interior</option>
												<option value="mechanical">Mechanical</option>
												<option value="other">Other</option>
											</select>
										</FormField>
										<FormField label="Severity">
											<select
												className="h-10 w-full rounded-md border bg-background px-3 text-sm"
												value={draft.severity}
												onChange={(event) => {
													setDamageDrafts((current) =>
														current.map((item) =>
															item.id === draft.id
																? {
																		...item,
																		severity: event.target
																			.value as RentalDamageSeverity,
																	}
																: item,
														),
													)
												}}
											>
												<option value="minor">Minor</option>
												<option value="moderate">Moderate</option>
												<option value="severe">Severe</option>
											</select>
										</FormField>
									</div>
									<FormField label="Short title">
										<Input
											value={draft.title}
											onChange={(event) => {
												setDamageDrafts((current) =>
													current.map((item) =>
														item.id === draft.id
															? {
																	...item,
																	title: event.target.value,
																}
															: item,
													),
												)
											}}
											placeholder="e.g. Front bumper scratch"
										/>
									</FormField>
									<FormField label="Notes">
										<Textarea
											value={draft.description}
											onChange={(event) => {
												setDamageDrafts((current) =>
													current.map((item) =>
														item.id === draft.id
															? {
																	...item,
																	description: event.target.value,
																}
															: item,
													),
												)
											}}
											placeholder="Explain what changed and where it was found."
										/>
									</FormField>
									<div className="grid gap-3 md:grid-cols-3">
										<FormField label="Estimated cost">
											<Input
												value={draft.estimatedCost}
												onChange={(event) => {
													setDamageDrafts((current) =>
														current.map((item) =>
															item.id === draft.id
																? {
																		...item,
																		estimatedCost: event.target.value,
																	}
																: item,
														),
													)
												}}
												placeholder="0.00"
											/>
										</FormField>
										<FormField label="Actual cost">
											<Input
												value={draft.actualCost}
												onChange={(event) => {
													setDamageDrafts((current) =>
														current.map((item) =>
															item.id === draft.id
																? {
																		...item,
																		actualCost: event.target.value,
																	}
																: item,
														),
													)
												}}
												placeholder="0.00"
											/>
										</FormField>
										<FormField label="Customer liability">
											<Input
												value={draft.customerLiabilityAmount}
												onChange={(event) => {
													setDamageDrafts((current) =>
														current.map((item) =>
															item.id === draft.id
																? {
																		...item,
																		customerLiabilityAmount: event.target.value,
																	}
																: item,
														),
													)
												}}
												placeholder="0.00"
											/>
										</FormField>
									</div>
									<MediaUploader
										entityType="rental-return"
										entityId={rentalId}
										handleUploadUrl={`/api/rentals/${rentalId}/media/upload`}
										finalizeUrl={`/api/rentals/${rentalId}/media/finalize`}
										field={`return-damage-${draft.id}`}
										branchId={detail.branch?.id ?? null}
										metadata={{
											rentalId,
											source: "return_flow",
											group: "damage",
											damageDraftId: draft.id,
										}}
										onUploaded={(result) => {
											setDamageDrafts((current) =>
												current.map((item) =>
													item.id === draft.id
														? {
																...item,
																media: [
																	...item.media,
																	...result.map((photo) => ({
																		assetId: photo.assetId,
																		deliveryUrl: photo.deliveryUrl,
																		blurDataUrl: photo.blurDataUrl ?? "",
																		label: "Damage photo",
																	})),
																],
															}
														: item,
												),
											)
											toast.success("Damage photo added.")
										}}
									/>
									<MediaPreviewGrid
										items={draft.media}
										onRemove={(assetId) => {
											setDamageDrafts((current) =>
												current.map((item) =>
													item.id === draft.id
														? {
																...item,
																media: item.media.filter(
																	(photo) => photo.assetId !== assetId,
																),
															}
														: item,
												),
											)
										}}
									/>
								</div>
							))}
						</CardContent>
					</Card>

					<Card className="border-border/70">
						<CardHeader>
							<div className="flex items-center justify-between gap-3">
								<div>
									<CardTitle>Extra expenses</CardTitle>
									<CardDescription>
										Add costs like fuel, cleaning, late return, tolls, fines, or
										other branch expenses.
									</CardDescription>
								</div>
								<Button
									type="button"
									variant="outline"
									onClick={addExpenseDraft}
								>
									Add expense
								</Button>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							{expenseDrafts.length === 0 ? (
								<div className="rounded-2xl border border-dashed p-4">
									<p className="text-muted-foreground text-sm">
										No extra expenses added. Continue if nothing else needs to
										be charged at return.
									</p>
								</div>
							) : null}

							{expenseDrafts.map((draft, index) => (
								<div
									key={draft.id}
									className="space-y-4 rounded-2xl border p-4"
								>
									<div className="flex items-center justify-between gap-2">
										<p className="font-medium">Expense item {index + 1}</p>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onClick={() => {
												if (draft.persistedChargeId) {
													setRemovedChargeIds((current) => [
														...current,
														draft.persistedChargeId as string,
													])
												}
												setExpenseDrafts((current) =>
													current.filter((item) => item.id !== draft.id),
												)
											}}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<FormField label="Type">
											<select
												className="h-10 w-full rounded-md border bg-background px-3 text-sm"
												value={draft.kind}
												onChange={(event) => {
													setExpenseDrafts((current) =>
														current.map((item) =>
															item.id === draft.id
																? {
																		...item,
																		kind: event.target
																			.value as ReturnExpenseDraft["kind"],
																	}
																: item,
														),
													)
												}}
											>
												<option value="fuel">Fuel</option>
												<option value="cleaning">Cleaning</option>
												<option value="late_return">Late return</option>
												<option value="toll">Toll</option>
												<option value="fine">Fine</option>
												<option value="other">Other</option>
											</select>
										</FormField>
										<FormField label="Due at">
											<Input
												type="datetime-local"
												value={draft.dueAt}
												onChange={(event) => {
													setExpenseDrafts((current) =>
														current.map((item) =>
															item.id === draft.id
																? {
																		...item,
																		dueAt: event.target.value,
																	}
																: item,
														),
													)
												}}
											/>
										</FormField>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<FormField label="Amount">
											<Input
												value={draft.amount}
												onChange={(event) => {
													setExpenseDrafts((current) =>
														current.map((item) =>
															item.id === draft.id
																? {
																		...item,
																		amount: event.target.value,
																	}
																: item,
														),
													)
												}}
												placeholder="0.00"
											/>
										</FormField>
										<FormField label="Tax">
											<Input
												value={draft.taxAmount}
												onChange={(event) => {
													setExpenseDrafts((current) =>
														current.map((item) =>
															item.id === draft.id
																? {
																		...item,
																		taxAmount: event.target.value,
																	}
																: item,
														),
													)
												}}
												placeholder="0.00"
											/>
										</FormField>
									</div>
									<FormField label="Description">
										<Textarea
											value={draft.description}
											onChange={(event) => {
												setExpenseDrafts((current) =>
													current.map((item) =>
														item.id === draft.id
															? {
																	...item,
																	description: event.target.value,
																}
															: item,
													),
												)
											}}
											placeholder="Explain why this fee is being added."
										/>
									</FormField>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</div>
		)
	}

	function renderSettlementStep() {
		return (
			<div className="space-y-5">
				<SectionNote
					icon={<Wallet className="size-4" />}
					title="Collect what is still due now"
					description="This step brings together unpaid schedule rows and return-time charges so the branch can finish with confidence."
				/>

				<div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
					<div className="space-y-4">
						<Card className="border-border/70">
							<CardHeader>
								<CardTitle>Balance summary</CardTitle>
								<CardDescription>
									Use this summary to confirm whether anything still needs to be
									collected before the vehicle can be closed out.
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-3 sm:grid-cols-3">
								<div className="rounded-2xl border bg-muted/20 p-4">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
										Scheduled balance
									</p>
									<p className="mt-2 text-xl font-semibold">
										{formatCurrency(
											detail.financials.scheduledOutstanding,
											detail.deposit.currency,
										)}
									</p>
								</div>
								<div className="rounded-2xl border bg-muted/20 p-4">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
										Return charges
									</p>
									<p className="mt-2 text-xl font-semibold">
										{formatCurrency(
											detail.financials.extraChargesOutstanding,
											detail.deposit.currency,
										)}
									</p>
								</div>
								<div className="rounded-2xl border bg-muted/20 p-4">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
										Due now
									</p>
									<p className="mt-2 text-xl font-semibold">
										{formatCurrency(dueNowTotal, detail.deposit.currency)}
									</p>
								</div>
							</CardContent>
						</Card>

						<Card className="border-border/70">
							<CardHeader>
								<CardTitle>Scheduled payments</CardTitle>
								<CardDescription>
									Collect any unpaid rental balance here.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{openScheduleRows.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										No scheduled balance is outstanding.
									</p>
								) : (
									openScheduleRows.map((row) => (
										<div key={row.id} className="rounded-2xl border p-4">
											<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
												<div>
													<p className="font-medium">{row.label}</p>
													<p className="text-muted-foreground text-sm">
														Due {formatDateTime(row.dueAt)} and currently{" "}
														{row.status.replaceAll("_", " ")}.
													</p>
												</div>
												<p className="text-lg font-semibold">
													{formatCurrency(row.amount, row.currency)}
												</p>
											</div>
											<div className="mt-4 grid gap-3 lg:grid-cols-[1fr,auto,auto,auto]">
												<Input
													value={scheduleCashAmounts[row.id] ?? ""}
													onChange={(event) => {
														setScheduleCashAmounts((current) => ({
															...current,
															[row.id]: event.target.value,
														}))
													}}
													placeholder="Cash received"
												/>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														void handleCollectScheduleCash(row.id)
													}}
												>
													<Banknote className="mr-2 size-4" />
													Collect cash
												</Button>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														void handlePrepareSchedulePayment(row.id, "card")
													}}
												>
													<CreditCard className="mr-2 size-4" />
													Prepare card
												</Button>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														void handlePrepareSchedulePayment(
															row.id,
															"au_becs_debit",
														)
													}}
												>
													<FileText className="mr-2 size-4" />
													Prepare debit
												</Button>
											</div>
										</div>
									))
								)}
							</CardContent>
						</Card>

						<Card className="border-border/70">
							<CardHeader>
								<CardTitle>Return charges</CardTitle>
								<CardDescription>
									Settle damage fees, cleaning, fuel, and any other extra cost
									known at handback.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{openChargeRows.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										No extra charges are waiting for collection.
									</p>
								) : (
									openChargeRows.map((charge) => (
										<div key={charge.id} className="rounded-2xl border p-4">
											<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
												<div>
													<p className="font-medium">
														{charge.kind.replaceAll("_", " ")}
													</p>
													<p className="text-muted-foreground text-sm">
														{charge.description?.trim() ||
															"No description was added for this charge."}
													</p>
												</div>
												<div className="text-right">
													<p className="text-lg font-semibold">
														{formatCurrency(charge.total, charge.currency)}
													</p>
													<Badge variant="outline">{charge.status}</Badge>
												</div>
											</div>
											<div className="mt-4 grid gap-3 lg:grid-cols-[1fr,auto,auto]">
												<Input
													value={chargeCashAmounts[charge.id] ?? ""}
													onChange={(event) => {
														setChargeCashAmounts((current) => ({
															...current,
															[charge.id]: event.target.value,
														}))
													}}
													placeholder="Cash received"
												/>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														void handleCollectCharge(charge, "cash")
													}}
												>
													<Banknote className="mr-2 size-4" />
													Collect cash
												</Button>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														void handleCollectCharge(charge, "card")
													}}
												>
													<CreditCard className="mr-2 size-4" />
													Mark card paid
												</Button>
											</div>
										</div>
									))
								)}
							</CardContent>
						</Card>
					</div>

					<div className="space-y-4">
						{paymentSession ? (
							<Card className="border-border/70">
								<CardHeader>
									<CardTitle>Prepared payment flow</CardTitle>
									<CardDescription>
										Finish the card or direct debit flow here, then refresh the
										balance summary.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{paymentSession.paymentMethodType === "card" ? (
										<RentalPaymentTerminalPanel
											rentalId={rentalId}
											payments={detail.payments}
										/>
									) : (
										<RentalPaymentAuBecsForm
											rentalId={rentalId}
											paymentSession={paymentSession}
											customerName={detail.customer?.fullName ?? ""}
											customerEmail={detail.customer?.email ?? ""}
											onConfirmed={() => {
												setPaymentSession(null)
												void refreshDetail()
											}}
										/>
									)}
									<Button
										type="button"
										variant="ghost"
										onClick={() => {
											setPaymentSession(null)
										}}
									>
										Clear prepared flow
									</Button>
								</CardContent>
							</Card>
						) : null}

						<Card className="border-border/70">
							<CardHeader>
								<CardTitle>Ready to finish?</CardTitle>
								<CardDescription>
									Move on only when the due-now amount is zero.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="rounded-2xl border bg-muted/20 p-4">
									<p className="text-sm font-medium">
										{dueNowTotal <= 0.009
											? "The current balance is settled."
											: "There is still money to collect before you can finish."}
									</p>
									<p className="text-muted-foreground mt-1 text-sm">
										When this reaches zero, the next step will focus on the
										deposit and final closeout.
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										void refreshDetail()
									}}
								>
									Refresh balance
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		)
	}

	function renderDepositAndFinishStep() {
		const blockers = [
			!detail.actionState.hasReturnInspection
				? "Return inspection is still missing."
				: null,
			detail.actionState.hasOutstandingScheduledBalance
				? "Scheduled rental balance is still outstanding."
				: null,
			detail.actionState.hasOutstandingExtraCharges
				? "One or more extra charges still need payment."
				: null,
			detail.actionState.requiresDepositResolution
				? "Deposit still needs a final decision."
				: null,
		].filter(Boolean) as string[]

		return (
			<div className="space-y-5">
				<SectionNote
					icon={<ShieldCheck className="size-4" />}
					title="Finish the return with a clear final decision"
					description="This last step helps staff confirm that the deposit and outstanding balance are fully resolved before the rental is completed."
				/>

				<div className="grid gap-4 xl:grid-cols-[1fr,0.95fr]">
					<div className="space-y-4">
						<Card className="border-border/70">
							<CardHeader>
								<CardTitle>Deposit resolution</CardTitle>
								<CardDescription>
									Release, refund, retain, or apply the held deposit before
									closing the rental.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid gap-3 sm:grid-cols-3">
									<div className="rounded-2xl border bg-muted/20 p-4">
										<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
											Held now
										</p>
										<p className="mt-2 text-xl font-semibold">
											{formatCurrency(
												detail.financials.depositHeld,
												detail.deposit.currency,
											)}
										</p>
									</div>
									<div className="rounded-2xl border bg-muted/20 p-4">
										<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
											Released
										</p>
										<p className="mt-2 text-xl font-semibold">
											{formatCurrency(
												detail.financials.depositReleased,
												detail.deposit.currency,
											)}
										</p>
									</div>
									<div className="rounded-2xl border bg-muted/20 p-4">
										<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
											Applied / retained
										</p>
										<p className="mt-2 text-xl font-semibold">
											{formatCurrency(
												detail.financials.depositApplied +
													detail.financials.depositRetained,
												detail.deposit.currency,
											)}
										</p>
									</div>
								</div>

								{detail.financials.depositHeld > 0 ? (
									<div className="space-y-4 rounded-2xl border p-4">
										<div className="grid gap-3 md:grid-cols-2">
											<FormField label="Decision">
												<select
													className="h-10 w-full rounded-md border bg-background px-3 text-sm"
													value={depositAction}
													onChange={(event) => {
														setDepositAction(
															event.target.value as typeof depositAction,
														)
													}}
												>
													<option value="release">Release hold</option>
													<option value="refund">Refund deposit</option>
													<option value="retain">Retain deposit</option>
													<option value="apply_to_charge">
														Apply to an open charge
													</option>
												</select>
											</FormField>
											<FormField label="Amount">
												<Input
													value={depositAmount}
													onChange={(event) => {
														setDepositAmount(event.target.value)
													}}
													placeholder="0.00"
												/>
											</FormField>
										</div>

										{depositAction === "apply_to_charge" ? (
											<FormField label="Open charge">
												<select
													className="h-10 w-full rounded-md border bg-background px-3 text-sm"
													value={depositChargeId}
													onChange={(event) => {
														setDepositChargeId(event.target.value)
													}}
												>
													<option value="">Select a charge</option>
													{openChargeRows.map((charge) => (
														<option key={charge.id} value={charge.id}>
															{charge.kind.replaceAll("_", " ")} -{" "}
															{formatCurrency(charge.total, charge.currency)}
														</option>
													))}
												</select>
											</FormField>
										) : null}

										<FormField label="Note">
											<Textarea
												value={depositNote}
												onChange={(event) => {
													setDepositNote(event.target.value)
												}}
												placeholder="Explain the decision for the team."
											/>
										</FormField>

										<Button
											type="button"
											onClick={() => {
												void handleResolveDeposit()
											}}
											disabled={resolveDepositMutation.isPending}
										>
											{resolveDepositMutation.isPending
												? "Saving deposit decision..."
												: "Save deposit decision"}
										</Button>
									</div>
								) : (
									<div className="rounded-2xl border bg-muted/20 p-4">
										<p className="text-sm font-medium">
											No held deposit needs action right now.
										</p>
										<p className="text-muted-foreground mt-1 text-sm">
											You can review the summary below and complete the return
											when you are ready.
										</p>
									</div>
								)}
							</CardContent>
						</Card>

						<Card className="border-border/70">
							<CardHeader>
								<CardTitle>Final notes</CardTitle>
								<CardDescription>
									Add a short closeout note if the team needs a final summary.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<Textarea
									value={completionNotes}
									onChange={(event) => {
										setCompletionNotes(event.target.value)
									}}
									placeholder="Return completed with no new damage, customer informed about cleaning fee, etc."
								/>
								<Button
									type="button"
									onClick={() => {
										void handleCompleteReturn()
									}}
									disabled={
										!detail.actionState.canCompleteReturn ||
										returnMutation.isPending
									}
								>
									{returnMutation.isPending
										? "Completing..."
										: "Complete return"}
								</Button>
							</CardContent>
						</Card>
					</div>

					<div className="space-y-4">
						<Card className="border-border/70">
							<CardHeader>
								<CardTitle>Return review</CardTitle>
								<CardDescription>
									This summary makes it easier to explain the outcome to staff
									and customers.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="rounded-2xl border bg-muted/20 p-4">
									<p className="text-sm font-medium">
										{detail.actionState.canCompleteReturn
											? "Everything needed for completion is in place."
											: "A few things still need attention before completion."}
									</p>
									<p className="text-muted-foreground mt-1 text-sm">
										Inspection, balance, and deposit all need to line up before
										the final button becomes available.
									</p>
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="rounded-2xl border p-4">
										<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
											Photos captured
										</p>
										<p className="mt-2 text-xl font-semibold">
											{exteriorPhotos.length +
												interiorPhotos.length +
												dashboardPhotos.length +
												additionalPhotos.length}
										</p>
									</div>
									<div className="rounded-2xl border p-4">
										<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
											Damage items
										</p>
										<p className="mt-2 text-xl font-semibold">
											{damageDrafts.length}
										</p>
									</div>
								</div>
								<div className="rounded-2xl border p-4">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
										Balance due now
									</p>
									<p className="mt-2 text-xl font-semibold">
										{formatCurrency(dueNowTotal, detail.deposit.currency)}
									</p>
								</div>
							</CardContent>
						</Card>

						<Card className="border-border/70">
							<CardHeader>
								<CardTitle>What still needs attention</CardTitle>
								<CardDescription>
									Simple language helps the branch team see the blockers fast.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{blockers.length === 0 ? (
									<div className="rounded-2xl border bg-emerald-50 p-4 text-emerald-800">
										Everything needed for return completion is ready.
									</div>
								) : (
									blockers.map((message) => (
										<div
											key={message}
											className="flex gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-amber-950"
										>
											<AlertCircle className="mt-0.5 size-4 shrink-0" />
											<p className="text-sm">{message}</p>
										</div>
									))
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		)
	}

	return (
		<ResponsiveDrawer
			open={open}
			onOpenChange={onOpenChange}
			title="Vehicle return"
			description="Guide the branch through check-in, evidence, charges, balance, and deposit resolution in one place."
			desktopClassName="max-h-[90vh] overflow-y-auto sm:max-w-6xl"
			mobileClassName="max-h-[94vh] overflow-y-auto rounded-t-3xl p-0"
		>
			<div className="space-y-6 pb-2">
				<div className="space-y-4">
					<div className="rounded-[28px] border bg-muted/20 p-4">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
							<div>
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="outline">Return flow</Badge>
									<Badge variant="outline">
										{detail.vehicle?.label ?? "Vehicle pending"}
									</Badge>
								</div>
								<h2 className="mt-3 text-xl font-semibold">
									Bring the rental back to a clear final state
								</h2>
								<p className="text-muted-foreground mt-1 text-sm">
									Each step keeps the team focused on one job at a time, so the
									return is easier to understand and harder to miss.
								</p>
							</div>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded-2xl border bg-background px-4 py-3">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
										Balance due
									</p>
									<p className="mt-2 font-semibold">
										{formatCurrency(dueNowTotal, detail.deposit.currency)}
									</p>
								</div>
								<div className="rounded-2xl border bg-background px-4 py-3">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
										Deposit held
									</p>
									<p className="mt-2 font-semibold">
										{formatCurrency(
											detail.financials.depositHeld,
											detail.deposit.currency,
										)}
									</p>
								</div>
								<div className="rounded-2xl border bg-background px-4 py-3">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
										Return status
									</p>
									<p className="mt-2 font-semibold">
										{detail.actionState.canCompleteReturn
											? "Ready to close"
											: "Needs review"}
									</p>
								</div>
							</div>
						</div>
					</div>

					<div className="flex gap-3 overflow-x-auto pb-1">
						{returnSteps.map((item, index) => (
							<StepCard
								key={item.title}
								index={index}
								title={item.title}
								description={item.description}
								active={step === index}
								completed={stepCompleted[index]}
							/>
						))}
					</div>
				</div>

				{step === 0 ? renderCheckInStep() : null}
				{step === 1 ? renderPhotosStep() : null}
				{step === 2 ? renderDamageAndExpensesStep() : null}
				{step === 3 ? renderSettlementStep() : null}
				{step === 4 ? renderDepositAndFinishStep() : null}

				<div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							if (step === 0) {
								onOpenChange(false)
								return
							}
							setStep((current) => Math.max(0, current - 1))
						}}
					>
						{step === 0 ? "Close" : "Back"}
					</Button>
					{step < 4 ? (
						<Button
							type="button"
							onClick={() => {
								void handleNext()
							}}
							disabled={
								isSavingStep ||
								saveInspectionMutation.isPending ||
								createChargeMutation.isPending ||
								updateChargeMutation.isPending
							}
						>
							{isSavingStep ? (
								<>
									<LoaderCircle className="mr-2 size-4 animate-spin" />
									Saving step...
								</>
							) : (
								<>
									{step === 2 ? "Save and continue" : "Continue"}
									<ArrowRight className="ml-2 size-4" />
								</>
							)}
						</Button>
					) : null}
				</div>
			</div>
		</ResponsiveDrawer>
	)
}
