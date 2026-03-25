"use client"

import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	LoaderCircle,
	ShieldCheck,
	Trash2,
} from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { MediaUploader } from "@/components/media/media-uploader"
import { RentalConditionMediaPreview } from "@/components/rentals/rental-condition-media-preview"
import { RentalConditionRatingSelector } from "@/components/rentals/rental-condition-rating-selector"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import {
	type RentalConditionRating,
	type RentalDamageCategory,
	type RentalDamageSeverity,
	type RentalDetailResponse,
	type RentalInspectionCleanliness,
	useHandoverRentalMutation,
	useSaveRentalInspectionMutation,
} from "@/features/rentals"
import { resolveErrorMessage } from "@/lib/errors"
import {
	completedStepCardClassName,
	completedStepIndicatorClassName,
	statusToneClassName,
} from "@/lib/theme-styles"
import { cn } from "@/lib/utils"

type RentalHandoverDrawerProps = {
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

type HandoverDamageDraft = {
	id: string
	category: RentalDamageCategory
	severity: RentalDamageSeverity
	title: string
	description: string
}

const handoverSteps = [
	{
		title: "Readiness",
		description:
			"Confirm the rental, vehicle, and payment state before release.",
	},
	{
		title: "Handover log",
		description: "Record the readings and checks taken at key release.",
	},
	{
		title: "Evidence & confirm",
		description: "Add optional condition proof, then activate the rental.",
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

function toOptionalNumber(value: string) {
	if (!value.trim()) {
		return null
	}

	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

function formatConditionRatingLabel(value: RentalConditionRating | null) {
	if (!value) {
		return "Not recorded"
	}

	return value
		.split("_")
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ")
}

function StepCard(props: {
	index: number
	title: string
	description: string
	active: boolean
	completed: boolean
}) {
	return (
		<div
			className={cn(
				"min-w-52 rounded-[24px] border px-4 py-3 transition-colors md:min-w-0",
				props.completed && completedStepCardClassName,
				props.active && "border-primary bg-primary/8 text-foreground shadow-sm",
				!props.active && !props.completed && "bg-background",
			)}
		>
			<div className="flex items-start gap-3">
				<div
					className={cn(
						"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
						props.completed && completedStepIndicatorClassName,
						props.active && "border-primary bg-primary/10 text-primary",
						!props.active &&
							!props.completed &&
							"border-border text-muted-foreground",
					)}
				>
					{props.completed ? (
						<CheckCircle2 className="size-4" />
					) : (
						props.index + 1
					)}
				</div>
				<div>
					<p className="text-sm font-semibold">{props.title}</p>
					<p className="text-muted-foreground mt-1 text-xs leading-5">
						{props.description}
					</p>
				</div>
			</div>
		</div>
	)
}

function DetailPair(props: { label: string; value: string; hint?: string }) {
	return (
		<div className="rounded-2xl border bg-background px-4 py-3">
			<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
				{props.label}
			</p>
			<p className="mt-2 text-sm font-semibold">{props.value}</p>
			{props.hint ? (
				<p className="text-muted-foreground mt-1 text-xs leading-5">
					{props.hint}
				</p>
			) : null}
		</div>
	)
}

function FormField(props: {
	label: string
	children: ReactNode
	description?: string
}) {
	return (
		<div className="space-y-2">
			<div>
				<p className="text-sm font-medium">{props.label}</p>
				{props.description ? (
					<p className="text-muted-foreground mt-1 text-xs leading-5">
						{props.description}
					</p>
				) : null}
			</div>
			{props.children}
		</div>
	)
}

export function RentalHandoverDrawer({
	open,
	onOpenChange,
	rentalId,
	detail,
	onUpdated,
}: RentalHandoverDrawerProps) {
	const authContextQuery = useAuthContextQuery()
	const organizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const inspectionMutation = useSaveRentalInspectionMutation(organizationId)
	const handoverMutation = useHandoverRentalMutation(organizationId)

	const [step, setStep] = useState(0)
	const [handoverOdometer, setHandoverOdometer] = useState("")
	const [handoverFuelPercent, setHandoverFuelPercent] = useState("")
	const [cleanliness, setCleanliness] =
		useState<RentalInspectionCleanliness>("clean")
	const [staffNotes, setStaffNotes] = useState("")
	const [checklist, setChecklist] = useState<Record<string, boolean>>({
		exteriorChecked: true,
		interiorChecked: true,
		keysReceived: true,
	})
	const [conditionChanged, setConditionChanged] = useState(false)
	const [conditionRating, setConditionRating] =
		useState<RentalConditionRating | null>(null)
	const [conditionMedia, setConditionMedia] = useState<UploadedMediaItem[]>([])
	const [damageDrafts, setDamageDrafts] = useState<HandoverDamageDraft[]>([])
	const [handoverAmountTendered, setHandoverAmountTendered] = useState("")

	const pickupInspection =
		detail.inspections.find((inspection) => inspection.stage === "pickup") ??
		null
	const firstPendingSchedule =
		detail.paymentSchedule.find((row) => row.status !== "succeeded") ??
		detail.paymentSchedule[0] ??
		null
	const requiresCashCollection =
		detail.rental.selectedPaymentMethodType === "cash" &&
		detail.rental.firstCollectionTiming === "handover" &&
		Boolean(firstPendingSchedule)

	const readinessBlockers = useMemo(() => {
		const blockers: string[] = []

		if (!detail.rental.selectedPaymentMethodType) {
			blockers.push("Payment method setup is missing for this rental.")
		}

		if (
			detail.rental.paymentPlanKind === "installment" &&
			detail.rental.firstCollectionTiming === "handover" &&
			detail.rental.selectedPaymentMethodType !== "cash" &&
			!detail.customer?.email &&
			!detail.customer?.phone
		) {
			blockers.push(
				"Customer needs an email or phone before recurring billing can be confirmed at handover.",
			)
		}

		return blockers
	}, [detail])

	useEffect(() => {
		if (!open) {
			setStep(0)
			return
		}

		setHandoverOdometer(
			pickupInspection?.odometerKm !== null &&
				pickupInspection?.odometerKm !== undefined
				? String(pickupInspection.odometerKm)
				: "",
		)
		setHandoverFuelPercent(
			pickupInspection?.fuelPercent !== null &&
				pickupInspection?.fuelPercent !== undefined
				? String(pickupInspection.fuelPercent)
				: "",
		)
		setCleanliness(pickupInspection?.cleanliness ?? "clean")
		setStaffNotes(pickupInspection?.notes ?? "")
		setChecklist(
			Object.keys(pickupInspection?.checklist ?? {}).length > 0
				? (pickupInspection?.checklist ?? {})
				: {
						exteriorChecked: true,
						interiorChecked: true,
						keysReceived: true,
					},
		)
		setConditionChanged(
			Boolean(
				pickupInspection?.conditionRating ||
					(pickupInspection?.media.length ?? 0) > 0 ||
					detail.damages.some(
						(damage) => damage.inspectionId === pickupInspection?.id,
					),
			),
		)
		setConditionRating(pickupInspection?.conditionRating ?? null)
		setConditionMedia(
			(pickupInspection?.media ?? []).map((item) => ({
				assetId: item.assetId,
				deliveryUrl: item.deliveryUrl,
				blurDataUrl: item.blurDataUrl,
				label: item.label,
			})),
		)
		setDamageDrafts(
			detail.damages
				.filter((damage) => damage.inspectionId === pickupInspection?.id)
				.map((damage) => ({
					id: damage.id,
					category: damage.category,
					severity: damage.severity,
					title: damage.title,
					description: damage.description ?? "",
				})),
		)
		setHandoverAmountTendered("")
	}, [detail, open, pickupInspection])

	function validateDetailsStep() {
		if (!handoverOdometer.trim()) {
			toast.error("Enter the odometer reading before continuing.")
			return false
		}

		return true
	}

	function validateConditionEvidence() {
		if (!conditionChanged) {
			return true
		}

		if (!conditionRating) {
			toast.error(
				"Select a condition rating when the vehicle condition changed.",
			)
			return false
		}

		if (conditionMedia.length === 0) {
			toast.error(
				"Add at least one photo or video proof when recording a condition change.",
			)
			return false
		}

		for (const [index, damage] of damageDrafts.entries()) {
			if (!damage.title.trim()) {
				toast.error(`Damage item ${index + 1} needs a short title.`)
				return false
			}
		}

		return true
	}

	async function handleCompleteHandover() {
		if (!validateDetailsStep() || !validateConditionEvidence()) {
			return
		}

		if (readinessBlockers.length > 0) {
			toast.error(
				"Resolve the handover blockers before activating this rental.",
			)
			return
		}

		if (
			requiresCashCollection &&
			(!handoverAmountTendered.trim() || Number(handoverAmountTendered) <= 0)
		) {
			toast.error("Enter the cash amount collected at handover.")
			return
		}

		try {
			await inspectionMutation.mutateAsync({
				rentalId,
				stage: "pickup",
				payload: {
					stage: "pickup",
					odometerKm: toOptionalNumber(handoverOdometer),
					fuelPercent: toOptionalNumber(handoverFuelPercent),
					cleanliness,
					conditionRating: conditionChanged ? conditionRating : null,
					updateVehicleCondition: conditionChanged,
					checklist,
					notes: staffNotes.trim(),
					media: conditionChanged
						? conditionMedia.map((item, index) => ({
								assetId: item.assetId,
								deliveryUrl: item.deliveryUrl,
								blurDataUrl: item.blurDataUrl,
								label: item.label ?? `Handover proof ${index + 1}`,
							}))
						: [],
					damages: conditionChanged
						? damageDrafts
								.filter((damage) => damage.title.trim().length > 0)
								.map((damage) => ({
									category: damage.category,
									title: damage.title.trim(),
									description: damage.description.trim(),
									severity: damage.severity,
								}))
						: [],
				},
			})

			await handoverMutation.mutateAsync({
				rentalId,
				payload: requiresCashCollection
					? {
							amountTendered: Number(handoverAmountTendered),
						}
					: {},
			})

			await onUpdated?.()
			onOpenChange(false)
			toast.success("Rental handed over.")
		} catch (error) {
			toast.error(resolveErrorMessage(error, "Failed to complete handover."))
		}
	}

	function handleNext() {
		if (step === 0) {
			setStep(1)
			return
		}

		if (step === 1) {
			if (!validateDetailsStep()) {
				return
			}
			setStep(2)
		}
	}

	const drawerBody = (
		<>
			<div className="shrink-0 border-b bg-background/90 backdrop-blur-sm">
				<DrawerHeader className="mx-auto w-full max-w-390 px-4 pb-4 pt-5 text-left sm:px-6 lg:px-8">
					<DrawerTitle className="text-2xl font-semibold tracking-tight">
						Rental handover
					</DrawerTitle>
					<DrawerDescription className="max-w-3xl text-sm">
						Guide the branch through the final checks, optional condition proof,
						and activation in one place.
					</DrawerDescription>
				</DrawerHeader>
				<div className="mx-auto w-full max-w-390 px-4 pb-5 sm:px-6 lg:px-8">
					<div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible">
						{handoverSteps.map((item, index) => (
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
					{step === 0 ? (
						<div className="space-y-5">
							<Card className="border-border/70">
								<CardHeader>
									<CardTitle>Handover readiness</CardTitle>
									<CardDescription>
										Review the rental, vehicle, and payment context before you
										hand over the keys.
									</CardDescription>
								</CardHeader>
								<CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
									<DetailPair
										label="Customer"
										value={detail.customer?.fullName ?? "Customer pending"}
										hint={
											detail.customer?.email ??
											detail.customer?.phone ??
											undefined
										}
									/>
									<DetailPair
										label="Vehicle"
										value={detail.vehicle?.label ?? "Vehicle pending"}
										hint={
											detail.rental.plannedStartAt
												? `Planned ${formatDateTime(detail.rental.plannedStartAt)}`
												: undefined
										}
									/>
									<DetailPair
										label="Payment method"
										value={
											detail.rental.selectedPaymentMethodType
												? detail.rental.selectedPaymentMethodType.replaceAll(
														"_",
														" ",
													)
												: "Not selected"
										}
										hint={
											detail.rental.firstCollectionTiming === "handover"
												? "First collection happens at handover."
												: "First collection is handled before handover."
										}
									/>
									<DetailPair
										label="Due now"
										value={
											requiresCashCollection && firstPendingSchedule
												? formatCurrency(
														firstPendingSchedule.amount,
														firstPendingSchedule.currency,
													)
												: "No cash due now"
										}
										hint={
											requiresCashCollection
												? "Collect the first scheduled charge before activating the rental."
												: "No desk collection is required in this step."
										}
									/>
								</CardContent>
							</Card>

							{detail.vehicle?.latestConditionSnapshot ? (
								<div className="rounded-[28px] border bg-muted/20 p-4">
									<div className="flex items-start gap-3">
										<ShieldCheck className="mt-0.5 size-4 shrink-0" />
										<div>
											<p className="text-sm font-semibold">
												Latest vehicle baseline
											</p>
											<p className="text-muted-foreground mt-1 text-sm">
												{formatConditionRatingLabel(
													detail.vehicle.latestConditionSnapshot.rating,
												)}{" "}
												from the{" "}
												{detail.vehicle.latestConditionSnapshot.inspectionStage}{" "}
												inspection.
											</p>
											<p className="text-muted-foreground mt-2 text-sm">
												Recorded{" "}
												{formatDateTime(
													detail.vehicle.latestConditionSnapshot.recordedAt,
												)}
												.
											</p>
										</div>
									</div>
								</div>
							) : (
								<div className="rounded-[28px] border bg-muted/20 p-4">
									<p className="text-sm font-semibold">
										Latest vehicle baseline
									</p>
									<p className="text-muted-foreground mt-1 text-sm">
										No prior vehicle condition snapshot is available yet.
									</p>
								</div>
							)}

							{readinessBlockers.length > 0 ? (
								<Card className={statusToneClassName("warning")}>
									<CardHeader>
										<CardTitle>What still needs attention</CardTitle>
										<CardDescription className="text-current/80">
											Resolve these items before the final handover action.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3">
										{readinessBlockers.map((message) => (
											<div
												key={message}
												className="flex gap-3 rounded-2xl border border-current/20 bg-background/80 p-4 text-current"
											>
												<AlertCircle className="mt-0.5 size-4 shrink-0" />
												<p className="text-sm">{message}</p>
											</div>
										))}
									</CardContent>
								</Card>
							) : null}
						</div>
					) : null}

					{step === 1 ? (
						<div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
							<Card className="border-border/70">
								<CardHeader>
									<CardTitle>Handover readings</CardTitle>
									<CardDescription>
										Record the vehicle state at the moment it leaves the branch.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid gap-4 sm:grid-cols-2">
										<FormField label="Odometer (km)">
											<Input
												value={handoverOdometer}
												onChange={(event) =>
													setHandoverOdometer(event.target.value)
												}
												placeholder="Required before handover"
											/>
										</FormField>
										<FormField
											label="Fuel / charge (%)"
											description="Optional. Use the best available reading for the vehicle."
										>
											<Input
												value={handoverFuelPercent}
												onChange={(event) =>
													setHandoverFuelPercent(event.target.value)
												}
												placeholder="Optional"
											/>
										</FormField>
									</div>

									<FormField label="Cleanliness">
										<select
											className="h-11 rounded-md border px-3"
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

									<FormField label="Staff notes">
										<Textarea
											value={staffNotes}
											onChange={(event) => setStaffNotes(event.target.value)}
											placeholder="Anything the next team or return flow should know."
										/>
									</FormField>
								</CardContent>
							</Card>

							<Card className="border-border/70">
								<CardHeader>
									<CardTitle>Quick checks</CardTitle>
									<CardDescription>
										Keep the handover record simple and thumb-friendly.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{[
										{ key: "exteriorChecked", label: "Exterior checked" },
										{ key: "interiorChecked", label: "Interior checked" },
										{ key: "keysReceived", label: "Keys received" },
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
												className="size-4"
											/>
										</label>
									))}

									<div className="rounded-[24px] border bg-muted/20 p-4">
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="text-sm font-semibold">
													Condition changed since latest baseline
												</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Turn this on only when handover should record new
													proof for this rental start.
												</p>
											</div>
											<Switch
												checked={conditionChanged}
												onCheckedChange={setConditionChanged}
											/>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					) : null}

					{step === 2 ? (
						<div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
							<div className="space-y-5">
								<Card className="border-border/70">
									<CardHeader>
										<CardTitle>Condition evidence</CardTitle>
										<CardDescription>
											Proof is optional unless staff marks that the vehicle
											condition changed.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										{conditionChanged ? (
											<>
												<FormField label="Condition rating">
													<RentalConditionRatingSelector
														value={conditionRating}
														onChange={setConditionRating}
													/>
												</FormField>

												<MediaUploader
													entityType="rental-pickup"
													entityId={rentalId}
													handleUploadUrl={`/api/rentals/${rentalId}/media/upload`}
													finalizeUrl={`/api/rentals/${rentalId}/media/finalize`}
													field="handover-condition"
													branchId={detail.branch?.id ?? null}
													metadata={{
														rentalId,
														source: "handover_condition",
													}}
													onUploaded={(result) => {
														setConditionMedia((current) => [
															...current,
															...result.map((item) => ({
																assetId: item.assetId,
																deliveryUrl: item.deliveryUrl,
																blurDataUrl: item.blurDataUrl ?? "",
																label: "Handover proof",
															})),
														])
													}}
												/>

												<RentalConditionMediaPreview
													items={conditionMedia}
													onRemove={(assetId) => {
														setConditionMedia((current) =>
															current.filter(
																(item) => item.assetId !== assetId,
															),
														)
													}}
												/>

												<div className="space-y-3">
													<div className="flex items-center justify-between">
														<p className="text-sm font-medium">Damage notes</p>
														<Button
															type="button"
															variant="outline"
															onClick={() => {
																setDamageDrafts((current) => [
																	...current,
																	{
																		id: createDraftId(),
																		category: "exterior",
																		severity: "minor",
																		title: "",
																		description: "",
																	},
																])
															}}
														>
															Add damage note
														</Button>
													</div>

													{damageDrafts.length === 0 ? (
														<div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
															No specific handover issues have been noted.
														</div>
													) : (
														damageDrafts.map((damage) => (
															<div
																key={damage.id}
																className="rounded-2xl border p-4"
															>
																<div className="flex items-start justify-between gap-3">
																	<p className="text-sm font-medium">
																		Damage note
																	</p>
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		onClick={() => {
																			setDamageDrafts((current) =>
																				current.filter(
																					(item) => item.id !== damage.id,
																				),
																			)
																		}}
																	>
																		<Trash2 className="size-4" />
																	</Button>
																</div>

																<div className="mt-3 grid gap-3 sm:grid-cols-3">
																	<select
																		className="h-11 rounded-md border px-3"
																		value={damage.category}
																		onChange={(event) => {
																			setDamageDrafts((current) =>
																				current.map((item) =>
																					item.id === damage.id
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
																		<option value="mechanical">
																			Mechanical
																		</option>
																		<option value="other">Other</option>
																	</select>

																	<select
																		className="h-11 rounded-md border px-3"
																		value={damage.severity}
																		onChange={(event) => {
																			setDamageDrafts((current) =>
																				current.map((item) =>
																					item.id === damage.id
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

																	<Input
																		value={damage.title}
																		onChange={(event) => {
																			setDamageDrafts((current) =>
																				current.map((item) =>
																					item.id === damage.id
																						? {
																								...item,
																								title: event.target.value,
																							}
																						: item,
																				),
																			)
																		}}
																		placeholder="Short damage note"
																	/>
																</div>

																<Textarea
																	value={damage.description}
																	onChange={(event) => {
																		setDamageDrafts((current) =>
																			current.map((item) =>
																				item.id === damage.id
																					? {
																							...item,
																							description: event.target.value,
																						}
																					: item,
																			),
																		)
																	}}
																	placeholder="Describe what changed at handover."
																/>
															</div>
														))
													)}
												</div>
											</>
										) : (
											<div className="rounded-2xl border bg-muted/20 p-4">
												<p className="text-sm font-semibold">
													No new condition evidence
												</p>
												<p className="text-muted-foreground mt-1 text-sm">
													This handover will save the structured readings only
													and keep the latest vehicle baseline unchanged.
												</p>
											</div>
										)}
									</CardContent>
								</Card>
							</div>

							<div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
								<Card className="border-border/70 bg-background/95">
									<CardHeader>
										<CardTitle>Handover confirmation</CardTitle>
										<CardDescription>
											The rental becomes active after the handover record is
											saved and payment-at-handover checks pass.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<DetailPair
											label="Inspection status"
											value={
												detail.actionState.missingPickupInspection
													? "Will be saved in this flow"
													: "Already recorded"
											}
										/>
										<DetailPair
											label="Condition proof"
											value={
												conditionChanged
													? `${conditionMedia.length} file${conditionMedia.length === 1 ? "" : "s"}`
													: "Not required"
											}
											hint={
												conditionChanged
													? "At least one proof file is required before handover."
													: "Leave the toggle off if the vehicle matches the latest baseline."
											}
										/>
										{requiresCashCollection && firstPendingSchedule ? (
											<FormField
												label="Cash collected now"
												description={`Collect ${formatCurrency(firstPendingSchedule.amount, firstPendingSchedule.currency)} before activation.`}
											>
												<Input
													value={handoverAmountTendered}
													onChange={(event) =>
														setHandoverAmountTendered(event.target.value)
													}
													placeholder="Amount tendered"
												/>
											</FormField>
										) : null}
										<div className="rounded-2xl border bg-muted/20 p-4 text-sm">
											<p className="font-medium">What happens next</p>
											<p className="text-muted-foreground mt-1">
												The inspection is saved first. If that succeeds, the
												rental moves to active and the vehicle status becomes
												rented.
											</p>
										</div>
									</CardContent>
								</Card>
							</div>
						</div>
					) : null}
				</div>
			</div>

			<div className="shrink-0 border-t bg-background/90 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
				<div className="mx-auto flex w-full max-w-390 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

					{step < 2 ? (
						<Button type="button" onClick={handleNext}>
							Continue
							<ArrowRight className="ml-2 size-4" />
						</Button>
					) : (
						<Button
							type="button"
							onClick={() => {
								void handleCompleteHandover()
							}}
							disabled={
								inspectionMutation.isPending || handoverMutation.isPending
							}
						>
							{inspectionMutation.isPending || handoverMutation.isPending ? (
								<>
									<LoaderCircle className="mr-2 size-4 animate-spin" />
									Completing handover...
								</>
							) : (
								"Save and handover vehicle"
							)}
						</Button>
					)}
				</div>
			</div>
		</>
	)

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent
				fullHeight
				className="overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),linear-gradient(to_bottom,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]"
			>
				{drawerBody}
			</DrawerContent>
		</Drawer>
	)
}
