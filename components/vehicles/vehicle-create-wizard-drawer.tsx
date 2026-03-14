"use client"

import {
	Camera,
	CarFront,
	CheckCircle2,
	Circle,
	ClipboardList,
	LoaderCircle,
	ShieldCheck,
	Sparkles,
} from "lucide-react"

import { MediaImage } from "@/components/media/media-image"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
	ColorDrawerInput,
	type DrawerOption,
	DrawerSelectInput,
} from "@/components/vehicles/vehicle-form-picker-controls"
import { VehicleImageGroupUpload } from "@/components/vehicles/vehicle-image-group-upload"
import type {
	DistanceUnit,
	Drivetrain,
	FuelType,
	PricingModel,
	Transmission,
	VehicleColor,
	VehicleFormValues,
	VehicleImageAsset,
	VehicleRatePayload,
	VehicleStatus,
} from "@/features/vehicles"
import { cn } from "@/lib/utils"

type VehicleImageGroupKey = "frontImages" | "backImages" | "interiorImages"
type VehicleFeatureKey = keyof VehicleFormValues["specs"]["features"]

type VehicleCreateWizardStep = {
	title: string
	description: string
}

type ImageGroupMeta = {
	title: string
	description: string
}

type ImagePreviewGroup = {
	key: VehicleImageGroupKey
	title: string
	assets: VehicleImageAsset[]
}

type VehicleCreateWizardDrawerProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	formError: string | null
	drawerStep: number
	steps: readonly VehicleCreateWizardStep[]
	formValues: VehicleFormValues
	selectedColor: VehicleColor
	colorPresets: VehicleColor[]
	brandOptions: DrawerOption[]
	modelOptions: DrawerOption[]
	vehicleClassOptions: DrawerOption[]
	bodyTypeOptions: DrawerOption[]
	yearOptions: DrawerOption[]
	seatOptions: DrawerOption[]
	doorOptions: DrawerOption[]
	baggageOptions: DrawerOption[]
	vehicleStatuses: VehicleStatus[]
	transmissions: Transmission[]
	fuelTypes: FuelType[]
	drivetrains: Drivetrain[]
	pricingModels: PricingModel[]
	rateEntries: VehicleRatePayload[]
	availablePricingModels: PricingModel[]
	activeImageGroup: VehicleImageGroupKey | null
	imageGroupLabels: Record<VehicleImageGroupKey, ImageGroupMeta>
	imagePreviewGroups: ImagePreviewGroup[]
	uploadedImageCount: number
	uploadingGroup: VehicleImageGroupKey | null
	uploadProgressByFile: Record<string, number>
	createVehiclePending: boolean
	uploadImagesPending: boolean
	onPreviousStep: () => void
	onNextStep: () => void
	onSubmitVehicle: () => void
	onBrandChange: (brandId: string) => void
	updateIdentity: (nextValues: Partial<VehicleFormValues["identity"]>) => void
	updateSpecs: (nextValues: Partial<VehicleFormValues["specs"]>) => void
	updateOperations: (
		nextValues: Partial<VehicleFormValues["operations"]>,
	) => void
	onFeatureChange: (feature: VehicleFeatureKey, checked: boolean) => void
	onUploadImageGroup: (group: VehicleImageGroupKey, files: File[]) => void
	onRemoveImage: (group: VehicleImageGroupKey, assetId: string) => void
	updateRateAtIndex: (
		rateIndex: number,
		nextValues: Partial<VehicleRatePayload>,
	) => void
	onRateModelChange: (rateIndex: number, pricingModel: PricingModel) => void
	onAddRate: () => void
	onRemoveRate: (rateIndex: number) => void
}

const stepDetails: Array<{
	title: string
	description: string
	icon: typeof CarFront
}> = [
	{
		title: "Identity and position",
		description:
			"Frame the vehicle the same way a renter would see it first: brand, model, class, and registration identity.",
		icon: CarFront,
	},
	{
		title: "Front image capture",
		description:
			"Lead with the strongest exterior angle so the catalog feels more like product merchandising than record keeping.",
		icon: Camera,
	},
	{
		title: "Rear image capture",
		description:
			"Round out the outside view with rear coverage that supports trust, condition, and listing quality.",
		icon: Camera,
	},
	{
		title: "Interior image capture",
		description:
			"Show the cabin experience clearly so renters understand comfort, condition, and layout before booking.",
		icon: Camera,
	},
	{
		title: "Core specifications",
		description:
			"Capture the spec details renters care about when comparing vehicles: drivetrain, transmission, capacity, and comfort features.",
		icon: Sparkles,
	},
	{
		title: "Operations readiness",
		description:
			"Set operational status and compliance dates so the vehicle is catalog-ready and safe to schedule.",
		icon: ShieldCheck,
	},
	{
		title: "Pricing models",
		description:
			"Make the monthly rate primary, then add only the pricing models that support your rental strategy.",
		icon: ClipboardList,
	},
] as const

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
				"min-w-[220px] rounded-[26px] border px-4 py-4 transition md:min-w-0",
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

function StepIntroCard({
	title,
	description,
	icon: Icon,
	badge,
}: {
	title: string
	description: string
	icon: typeof CarFront
	badge?: string
}) {
	return (
		<div className="rounded-[28px] border bg-background/88 p-5 sm:p-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="flex items-start gap-4">
					<div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15">
						<Icon className="size-5" />
					</div>
					<div>
						<p className="text-xl font-semibold">{title}</p>
						<p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
							{description}
						</p>
					</div>
				</div>
				{badge ? (
					<Badge className="rounded-full px-3 py-1.5 text-xs">{badge}</Badge>
				) : null}
			</div>
		</div>
	)
}

function ChecklistCard({
	title,
	items,
	className,
}: {
	title: string
	items: string[]
	className?: string
}) {
	return (
		<div
			className={cn(
				"rounded-[28px] border bg-background/90 p-5 sm:p-6",
				className,
			)}
		>
			<p className="text-sm font-semibold">{title}</p>
			<div className="mt-4 space-y-3">
				{items.map((item) => (
					<div key={item} className="flex items-start gap-3">
						<CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
						<p className="text-muted-foreground text-sm leading-relaxed">
							{item}
						</p>
					</div>
				))}
			</div>
		</div>
	)
}

function formatVehicleHeading(
	formValues: VehicleFormValues,
	brandOptions: DrawerOption[],
	modelOptions: DrawerOption[],
) {
	const brandLabel =
		brandOptions.find((option) => option.value === formValues.identity.brandId)
			?.label ?? "Brand"
	const modelLabel =
		modelOptions.find((option) => option.value === formValues.identity.modelId)
			?.label ?? "Model"

	return `${formValues.identity.year} ${brandLabel} ${modelLabel}`
}

function IdentitySummaryCard({
	formValues,
	brandOptions,
	modelOptions,
	vehicleClassOptions,
	bodyTypeOptions,
}: {
	formValues: VehicleFormValues
	brandOptions: DrawerOption[]
	modelOptions: DrawerOption[]
	vehicleClassOptions: DrawerOption[]
	bodyTypeOptions: DrawerOption[]
}) {
	const vehicleClassLabel =
		vehicleClassOptions.find(
			(option) =>
				option.value === (formValues.identity.vehicleClassId ?? "none"),
		)?.label ?? "No class yet"
	const bodyTypeLabel =
		bodyTypeOptions.find(
			(option) => option.value === (formValues.identity.bodyTypeId ?? "none"),
		)?.label ?? "No body type"

	return (
		<div className="space-y-5 rounded-[28px] border bg-background/95 p-5 sm:p-6">
			<div>
				<p className="text-sm font-semibold">Draft snapshot</p>
				<p className="text-muted-foreground mt-1 text-sm leading-relaxed">
					The create flow keeps a live summary so the person adding the vehicle
					can sanity-check the listing before moving into images and rates.
				</p>
			</div>

			<div className="rounded-[24px] border bg-muted/20 p-4">
				<p className="text-lg font-semibold">
					{formatVehicleHeading(formValues, brandOptions, modelOptions)}
				</p>
				<p className="text-muted-foreground mt-1 text-sm">
					{formValues.identity.licensePlate || "License plate not added yet"}
				</p>
			</div>

			<div className="grid gap-3 text-sm sm:grid-cols-2">
				<div className="rounded-2xl border bg-background/80 p-3">
					<p className="text-muted-foreground text-xs">Vehicle class</p>
					<p className="mt-1 font-medium">{vehicleClassLabel}</p>
				</div>
				<div className="rounded-2xl border bg-background/80 p-3">
					<p className="text-muted-foreground text-xs">Body type</p>
					<p className="mt-1 font-medium">{bodyTypeLabel}</p>
				</div>
				<div className="rounded-2xl border bg-background/80 p-3">
					<p className="text-muted-foreground text-xs">VIN</p>
					<p className="mt-1 font-medium">
						{formValues.identity.vin || "Pending"}
					</p>
				</div>
				<div className="rounded-2xl border bg-background/80 p-3">
					<p className="text-muted-foreground text-xs">Condition</p>
					<p className="mt-1 font-medium">
						{formValues.identity.isBrandNew ? "Brand new" : "Used vehicle"}
					</p>
				</div>
			</div>
		</div>
	)
}

function ImageProgressCard({
	activeImageGroup,
	imageGroupLabels,
	imagePreviewGroups,
	uploadedImageCount,
	uploadImagesPending,
}: {
	activeImageGroup: VehicleImageGroupKey | null
	imageGroupLabels: Record<VehicleImageGroupKey, ImageGroupMeta>
	imagePreviewGroups: ImagePreviewGroup[]
	uploadedImageCount: number
	uploadImagesPending: boolean
}) {
	return (
		<div className="space-y-5 rounded-[28px] border bg-background/95 p-5 sm:p-6">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-sm font-semibold">Image progress</p>
					<p className="text-muted-foreground mt-1 text-sm">
						Keep each angle covered before moving into specs and operations.
					</p>
				</div>
				<Badge variant="outline" className="rounded-full px-3 py-1">
					{uploadedImageCount} total
				</Badge>
			</div>

			<div className="space-y-3">
				{imagePreviewGroups.map((group) => {
					const isActive = group.key === activeImageGroup
					const complete = group.assets.length > 0
					return (
						<div
							key={group.key}
							className={cn(
								"rounded-2xl border px-4 py-3",
								isActive && "border-primary/30 bg-primary/[0.06]",
								complete && !isActive && "border-emerald-200 bg-emerald-50/70",
							)}
						>
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium">
										{imageGroupLabels[group.key].title}
									</p>
									<p className="text-muted-foreground mt-1 text-xs">
										{imageGroupLabels[group.key].description}
									</p>
								</div>
								<div className="flex items-center gap-2">
									{uploadImagesPending && isActive ? (
										<LoaderCircle className="text-primary size-4 animate-spin" />
									) : complete ? (
										<CheckCircle2 className="size-4 text-emerald-600" />
									) : (
										<Circle className="text-muted-foreground size-4" />
									)}
									<span className="text-sm font-medium">
										{group.assets.length}
									</span>
								</div>
							</div>
						</div>
					)
				})}
			</div>

			<div className="space-y-2">
				<p className="text-sm font-medium">Preview strip</p>
				<div className="grid grid-cols-3 gap-3">
					{imagePreviewGroups.map((group) => {
						const preview = group.assets[0]
						return (
							<div
								key={`${group.key}-preview`}
								className="rounded-2xl border bg-muted/20 p-2"
							>
								<div className="bg-muted/40 relative aspect-[4/3] overflow-hidden rounded-xl">
									{preview ? (
										<MediaImage
											asset={{
												id: preview.assetId,
												deliveryUrl: preview.deliveryUrl,
												visibility: "private",
												blurDataUrl: preview.blurDataUrl,
												originalFileName: `${group.title}-${preview.assetId}`,
												contentType: "image/jpeg",
											}}
											alt={group.title}
											fill
											sizes="(min-width: 1280px) 10vw, 24vw"
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="text-muted-foreground flex h-full items-center justify-center text-xs">
											No image
										</div>
									)}
								</div>
								<p className="mt-2 truncate text-xs font-medium">
									{group.title}
								</p>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

export function VehicleCreateWizardDrawer({
	open,
	onOpenChange,
	formError,
	drawerStep,
	steps,
	formValues,
	selectedColor,
	colorPresets,
	brandOptions,
	modelOptions,
	vehicleClassOptions,
	bodyTypeOptions,
	yearOptions,
	seatOptions,
	doorOptions,
	baggageOptions,
	vehicleStatuses,
	transmissions,
	fuelTypes,
	drivetrains,
	pricingModels,
	rateEntries,
	availablePricingModels,
	activeImageGroup,
	imageGroupLabels,
	imagePreviewGroups,
	uploadedImageCount,
	uploadingGroup,
	uploadProgressByFile,
	createVehiclePending,
	uploadImagesPending,
	onPreviousStep,
	onNextStep,
	onSubmitVehicle,
	onBrandChange,
	updateIdentity,
	updateSpecs,
	updateOperations,
	onFeatureChange,
	onUploadImageGroup,
	onRemoveImage,
	updateRateAtIndex,
	onRateModelChange,
	onAddRate,
	onRemoveRate,
}: VehicleCreateWizardDrawerProps) {
	const totalDrawerSteps = steps.length
	const stepMeta = stepDetails[drawerStep] ?? stepDetails[0]
	const vehicleHeading = formatVehicleHeading(
		formValues,
		brandOptions,
		modelOptions,
	)
	const identityBadge = formValues.identity.licensePlate
		? `${vehicleHeading} • ${formValues.identity.licensePlate}`
		: vehicleHeading

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent
				fullHeight
				className="overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_28%),linear-gradient(to_bottom,_rgba(248,250,252,0.96),_rgba(255,255,255,0.98))]"
			>
				<div className="shrink-0 border-b bg-background/90 backdrop-blur-sm">
					<DrawerHeader className="mx-auto w-full max-w-[1560px] px-4 pb-4 pt-5 text-left sm:px-6 lg:px-8">
						<DrawerTitle className="text-2xl font-semibold tracking-tight">
							Add vehicle to catalog
						</DrawerTitle>
						<DrawerDescription className="max-w-3xl text-sm">
							Product-style vehicle setup with staged image capture, cleaner
							spec entry, and pricing configuration that feels closer to a
							curated catalog flow than a back-office form.
						</DrawerDescription>
					</DrawerHeader>
					<div className="mx-auto w-full max-w-[1560px] px-4 pb-5 sm:px-6 lg:px-8">
						<div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-7 md:overflow-visible">
							{steps.map((item, index) => (
								<StepCard
									key={item.title}
									index={index}
									title={item.title}
									description={item.description}
									active={drawerStep === index}
									completed={index < drawerStep}
								/>
							))}
						</div>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
						{formError ? (
							<p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
								{formError}
							</p>
						) : null}

						{drawerStep === 0 ? (
							<FieldGroup className="space-y-6">
								<StepIntroCard
									title={stepMeta.title}
									description={stepMeta.description}
									icon={stepMeta.icon}
									badge={identityBadge}
								/>

								<div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
									<div className="space-y-6 rounded-[28px] border bg-background/90 p-5 sm:p-6">
										<div>
											<p className="text-sm font-semibold">Vehicle identity</p>
											<p className="text-muted-foreground mt-1 text-sm leading-relaxed">
												Start with the fields that define search,
												classification, and trust in the catalog. Everything
												here should make sense to the operations team and to the
												next rental setup flow.
											</p>
										</div>

										<div className="grid gap-5 md:grid-cols-2">
											<Field>
												<FieldLabel>Brand</FieldLabel>
												<DrawerSelectInput
													value={formValues.identity.brandId}
													placeholder="Select vehicle brand"
													drawerTitle="Select brand"
													options={brandOptions}
													onValueChange={onBrandChange}
												/>
											</Field>

											<Field>
												<FieldLabel>Model</FieldLabel>
												<DrawerSelectInput
													value={formValues.identity.modelId}
													placeholder={
														formValues.identity.brandId
															? "Select model"
															: "Select brand first"
													}
													drawerTitle="Select model"
													options={modelOptions}
													disabled={
														!formValues.identity.brandId ||
														modelOptions.length === 0
													}
													onValueChange={(value) =>
														updateIdentity({ modelId: value })
													}
												/>
											</Field>

											<Field>
												<FieldLabel>Vehicle class</FieldLabel>
												<DrawerSelectInput
													value={formValues.identity.vehicleClassId ?? "none"}
													placeholder="Select vehicle class"
													drawerTitle="Select vehicle class"
													options={vehicleClassOptions}
													onValueChange={(value) =>
														updateIdentity({
															vehicleClassId:
																value === "none" ? undefined : value,
														})
													}
												/>
											</Field>

											<Field>
												<FieldLabel>Body type</FieldLabel>
												<DrawerSelectInput
													value={formValues.identity.bodyTypeId ?? "none"}
													placeholder="Select body type"
													drawerTitle="Select body type"
													options={bodyTypeOptions}
													onValueChange={(value) =>
														updateIdentity({
															bodyTypeId: value === "none" ? undefined : value,
														})
													}
												/>
											</Field>

											<Field>
												<FieldLabel>Year</FieldLabel>
												<DrawerSelectInput
													value={String(formValues.identity.year)}
													placeholder="Select year"
													drawerTitle="Select year"
													options={yearOptions}
													onValueChange={(value) =>
														updateIdentity({ year: Number(value) })
													}
												/>
											</Field>

											<Field>
												<FieldLabel>Vehicle color</FieldLabel>
												<ColorDrawerInput
													value={selectedColor}
													colors={colorPresets}
													placeholder="Select vehicle color"
													onValueChange={(nextColor) =>
														updateIdentity({ color: nextColor })
													}
												/>
											</Field>
										</div>

										<div className="grid gap-5 md:grid-cols-2">
											<Field>
												<FieldLabel htmlFor="vehicle-plate">
													License plate
												</FieldLabel>
												<Input
													id="vehicle-plate"
													value={formValues.identity.licensePlate}
													onChange={(event) =>
														updateIdentity({
															licensePlate: event.target.value.toUpperCase(),
														})
													}
													className="h-12"
												/>
											</Field>

											<Field>
												<FieldLabel htmlFor="vehicle-vin">VIN</FieldLabel>
												<Input
													id="vehicle-vin"
													value={formValues.identity.vin}
													onChange={(event) =>
														updateIdentity({ vin: event.target.value })
													}
													className="h-12"
												/>
											</Field>
										</div>

										<div className="rounded-[24px] border bg-muted/20 p-4">
											<Field
												orientation="horizontal"
												className="items-center justify-between gap-4"
											>
												<div>
													<FieldLabel htmlFor="is-brand-new">
														Brand new vehicle
													</FieldLabel>
													<p className="text-muted-foreground mt-1 text-sm">
														Use this when the vehicle should be presented as new
														in inventory and future rental views.
													</p>
												</div>
												<Switch
													id="is-brand-new"
													checked={formValues.identity.isBrandNew}
													onCheckedChange={(checked) =>
														updateIdentity({ isBrandNew: checked })
													}
												/>
											</Field>
										</div>
									</div>

									<div className="space-y-6">
										<IdentitySummaryCard
											formValues={formValues}
											brandOptions={brandOptions}
											modelOptions={modelOptions}
											vehicleClassOptions={vehicleClassOptions}
											bodyTypeOptions={bodyTypeOptions}
										/>
										<ChecklistCard
											title="What this step sets up"
											items={[
												"Searchability in vehicle selection and rental checkout.",
												"Catalog labels used across listings, details, and pricing.",
												"Registration identity before images and rate setup.",
											]}
										/>
									</div>
								</div>
							</FieldGroup>
						) : null}

						{drawerStep >= 1 && drawerStep <= 3 && activeImageGroup ? (
							<FieldGroup className="space-y-6">
								<StepIntroCard
									title={stepMeta.title}
									description={stepMeta.description}
									icon={stepMeta.icon}
									badge={`${uploadedImageCount} images uploaded`}
								/>

								<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
									<div className="space-y-6 rounded-[28px] border bg-background/90 p-5 sm:p-6">
										<div>
											<p className="text-sm font-semibold">
												{imageGroupLabels[activeImageGroup].title}
											</p>
											<p className="text-muted-foreground mt-1 text-sm leading-relaxed">
												{imageGroupLabels[activeImageGroup].description} Keep
												the upload focused so each angle is easy to review
												later.
											</p>
										</div>

										<VehicleImageGroupUpload
											title={imageGroupLabels[activeImageGroup].title}
											description={
												imageGroupLabels[activeImageGroup].description
											}
											assets={formValues.images[activeImageGroup]}
											isUploading={
												uploadImagesPending &&
												uploadingGroup === activeImageGroup
											}
											uploadProgressByFile={
												uploadingGroup === activeImageGroup
													? uploadProgressByFile
													: {}
											}
											onFilesSelected={(files) => {
												onUploadImageGroup(activeImageGroup, files)
											}}
											onRemove={(assetId) =>
												onRemoveImage(activeImageGroup, assetId)
											}
											variant="wizard"
										/>
									</div>

									<div className="space-y-6">
										<ImageProgressCard
											activeImageGroup={activeImageGroup}
											imageGroupLabels={imageGroupLabels}
											imagePreviewGroups={imagePreviewGroups}
											uploadedImageCount={uploadedImageCount}
											uploadImagesPending={uploadImagesPending}
										/>
										<ChecklistCard
											title="Capture reminders"
											items={[
												"Use clean, evenly lit photos that feel customer-ready.",
												"Cover enough angles to support trust during rental selection.",
												"Each image gets a blur placeholder before you move ahead.",
											]}
										/>
									</div>
								</div>
							</FieldGroup>
						) : null}

						{drawerStep === 4 ? (
							<FieldGroup className="space-y-6">
								<StepIntroCard
									title={stepMeta.title}
									description={stepMeta.description}
									icon={stepMeta.icon}
									badge={`${formValues.specs.seats} seats • ${formValues.specs.doors} doors`}
								/>

								<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
									<div className="space-y-6">
										<div className="space-y-5 rounded-[28px] border bg-background/90 p-5 sm:p-6">
											<div>
												<p className="text-sm font-semibold">
													Powertrain setup
												</p>
												<p className="text-muted-foreground mt-1 text-sm">
													These are the comparison points renters notice first.
												</p>
											</div>

											<Field>
												<FieldLabel>Transmission</FieldLabel>
												<ToggleGroup
													type="single"
													value={formValues.specs.transmission}
													onValueChange={(value) => {
														if (!value) {
															return
														}
														updateSpecs({ transmission: value as Transmission })
													}}
													className="flex w-full flex-wrap gap-2"
												>
													{transmissions.map((transmission) => (
														<ToggleGroupItem
															key={transmission}
															value={transmission}
															className="h-11 px-3"
														>
															{transmission}
														</ToggleGroupItem>
													))}
												</ToggleGroup>
											</Field>

											<Field>
												<FieldLabel>Fuel type</FieldLabel>
												<ToggleGroup
													type="single"
													value={formValues.specs.fuelType}
													onValueChange={(value) => {
														if (!value) {
															return
														}
														updateSpecs({ fuelType: value as FuelType })
													}}
													className="flex w-full flex-wrap gap-2"
												>
													{fuelTypes.map((fuelType) => (
														<ToggleGroupItem
															key={fuelType}
															value={fuelType}
															className="h-11 px-3"
														>
															{fuelType}
														</ToggleGroupItem>
													))}
												</ToggleGroup>
											</Field>

											<Field>
												<FieldLabel>Drivetrain</FieldLabel>
												<ToggleGroup
													type="single"
													value={formValues.specs.drivetrain}
													onValueChange={(value) => {
														if (!value) {
															return
														}
														updateSpecs({ drivetrain: value as Drivetrain })
													}}
													className="flex w-full flex-wrap gap-2"
												>
													{drivetrains.map((drivetrain) => (
														<ToggleGroupItem
															key={drivetrain}
															value={drivetrain}
															className="h-11 px-3"
														>
															{drivetrain}
														</ToggleGroupItem>
													))}
												</ToggleGroup>
											</Field>
										</div>

										<div className="space-y-5 rounded-[28px] border bg-background/90 p-5 sm:p-6">
											<div>
												<p className="text-sm font-semibold">Cabin capacity</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Keep capacity details clear so booking expectations
													match the actual vehicle.
												</p>
											</div>

											<div className="grid gap-5 md:grid-cols-3">
												<Field>
													<FieldLabel>Seats</FieldLabel>
													<DrawerSelectInput
														value={String(formValues.specs.seats)}
														placeholder="Select seat count"
														drawerTitle="Select seats"
														options={seatOptions}
														onValueChange={(value) =>
															updateSpecs({ seats: Number(value) })
														}
													/>
												</Field>
												<Field>
													<FieldLabel>Doors</FieldLabel>
													<DrawerSelectInput
														value={String(formValues.specs.doors)}
														placeholder="Select door count"
														drawerTitle="Select doors"
														options={doorOptions}
														onValueChange={(value) =>
															updateSpecs({ doors: Number(value) })
														}
													/>
												</Field>
												<Field>
													<FieldLabel>Baggage</FieldLabel>
													<DrawerSelectInput
														value={String(formValues.specs.baggageCapacity)}
														placeholder="Select baggage count"
														drawerTitle="Select baggage capacity"
														options={baggageOptions}
														onValueChange={(value) =>
															updateSpecs({ baggageCapacity: Number(value) })
														}
													/>
												</Field>
											</div>
										</div>
									</div>

									<div className="space-y-6">
										<div className="space-y-5 rounded-[28px] border bg-background/95 p-5 sm:p-6">
											<div>
												<p className="text-sm font-semibold">
													Comfort features
												</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Select the features that materially influence customer
													choice.
												</p>
											</div>
											<div className="space-y-3">
												{[
													{
														key: "hasAC" as const,
														label: "Air conditioning",
														description:
															"Climate comfort for standard rentals.",
													},
													{
														key: "hasNavigation" as const,
														label: "Navigation",
														description:
															"Built-in navigation or equivalent support.",
													},
													{
														key: "hasBluetooth" as const,
														label: "Bluetooth",
														description:
															"Hands-free and device pairing support.",
													},
													{
														key: "isPetFriendly" as const,
														label: "Pet friendly",
														description:
															"Approved for renters traveling with pets.",
													},
												].map((feature) => (
													<div
														key={feature.key}
														className="rounded-2xl border bg-background/80 p-4"
													>
														<Field
															orientation="horizontal"
															className="items-center justify-between gap-4"
														>
															<div>
																<FieldLabel htmlFor={feature.key}>
																	{feature.label}
																</FieldLabel>
																<p className="text-muted-foreground mt-1 text-sm">
																	{feature.description}
																</p>
															</div>
															<Switch
																id={feature.key}
																checked={formValues.specs.features[feature.key]}
																onCheckedChange={(checked) =>
																	onFeatureChange(feature.key, checked)
																}
															/>
														</Field>
													</div>
												))}
											</div>
										</div>
										<ChecklistCard
											title="Spec quality bar"
											items={[
												"Use spec values that help renters compare quickly.",
												"Keep capacity honest so handover expectations stay aligned.",
												"Feature toggles should reflect what is actually available.",
											]}
										/>
									</div>
								</div>
							</FieldGroup>
						) : null}

						{drawerStep === 5 ? (
							<FieldGroup className="space-y-6">
								<StepIntroCard
									title={stepMeta.title}
									description={stepMeta.description}
									icon={stepMeta.icon}
									badge={formValues.operations.status}
								/>

								<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
									<div className="space-y-6">
										<div className="space-y-5 rounded-[28px] border bg-background/90 p-5 sm:p-6">
											<div>
												<p className="text-sm font-semibold">Fleet status</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Set the availability state that downstream rental
													flows and the catalog should respect.
												</p>
											</div>

											<Field>
												<FieldLabel>Status</FieldLabel>
												<ToggleGroup
													type="single"
													value={formValues.operations.status}
													onValueChange={(value) => {
														if (!value) {
															return
														}
														updateOperations({
															status: value as VehicleStatus,
														})
													}}
													className="flex w-full flex-wrap gap-2"
												>
													{vehicleStatuses.map((status) => (
														<ToggleGroupItem
															key={status}
															value={status}
															className="h-11 px-3"
														>
															{status}
														</ToggleGroupItem>
													))}
												</ToggleGroup>
											</Field>
										</div>

										<div className="space-y-5 rounded-[28px] border bg-background/90 p-5 sm:p-6">
											<div>
												<p className="text-sm font-semibold">
													Compliance dates
												</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Registration and insurance dates should be current
													before the vehicle starts appearing in active
													inventory.
												</p>
											</div>
											<div className="grid gap-5 md:grid-cols-2">
												<Field>
													<FieldLabel htmlFor="registration-expiry">
														Registration expiry
													</FieldLabel>
													<Input
														id="registration-expiry"
														type="date"
														value={formValues.operations.registrationExpiryDate}
														onChange={(event) =>
															updateOperations({
																registrationExpiryDate: event.target.value,
															})
														}
														className="h-12"
													/>
												</Field>
												<Field>
													<FieldLabel htmlFor="insurance-expiry">
														Insurance expiry
													</FieldLabel>
													<Input
														id="insurance-expiry"
														type="date"
														value={formValues.operations.insuranceExpiryDate}
														onChange={(event) =>
															updateOperations({
																insuranceExpiryDate: event.target.value,
															})
														}
														className="h-12"
													/>
												</Field>
											</div>
										</div>
									</div>

									<div className="space-y-6">
										<div className="space-y-5 rounded-[28px] border bg-background/95 p-5 sm:p-6">
											<div>
												<p className="text-sm font-semibold">
													Insurance record
												</p>
												<p className="text-muted-foreground mt-1 text-sm">
													Keep the policy reference here so the operations team
													can find it quickly without leaving the vehicle flow.
												</p>
											</div>
											<Field>
												<FieldLabel htmlFor="policy-number">
													Insurance policy number
												</FieldLabel>
												<Input
													id="policy-number"
													value={formValues.operations.insurancePolicyNumber}
													onChange={(event) =>
														updateOperations({
															insurancePolicyNumber: event.target.value,
														})
													}
													className="h-12"
												/>
											</Field>
										</div>
										<ChecklistCard
											title="Operations readiness"
											items={[
												"Status should mirror whether the vehicle can be rented now.",
												"Expiry dates must reflect compliance, not estimate.",
												"Policy reference should match the latest insurer record.",
											]}
										/>
									</div>
								</div>
							</FieldGroup>
						) : null}

						{drawerStep === 6 ? (
							<FieldGroup className="space-y-6">
								<StepIntroCard
									title={stepMeta.title}
									description={stepMeta.description}
									icon={stepMeta.icon}
									badge={`${rateEntries.length} pricing models`}
								/>

								<div className="space-y-6">
									{rateEntries.map((rate, rateIndex) => {
										const limitedMileagePolicy =
											rate.mileagePolicy.mileageType === "Limited"
												? rate.mileagePolicy
												: {
														mileageType: "Limited" as const,
														limitPerDay: 200,
														overageFeePerUnit: 0,
														measureUnit: "km" as DistanceUnit,
													}
										const isMonthlyPrimary = rate.pricingModel === "Monthly"

										function isUsedByAnotherRate(pricingModel: PricingModel) {
											return rateEntries.some(
												(entry, entryIndex) =>
													entryIndex !== rateIndex &&
													entry.pricingModel === pricingModel,
											)
										}

										return (
											<div
												key={`${rate.pricingModel}-${rateIndex}`}
												className={cn(
													"rounded-[28px] border p-5 sm:p-6",
													isMonthlyPrimary
														? "border-primary/30 bg-primary/[0.05]"
														: "bg-background/92",
												)}
											>
												<div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
													<div className="space-y-4">
														<div>
															<p className="text-sm font-semibold">
																{rate.pricingModel} rental
															</p>
															<p className="text-muted-foreground mt-1 text-sm leading-relaxed">
																{isMonthlyPrimary
																	? "This is the required primary pricing model for each vehicle."
																	: "Use optional models only when they support a real booking path."}
															</p>
														</div>
														<div className="flex flex-wrap gap-2">
															<Badge
																variant={
																	isMonthlyPrimary ? "default" : "outline"
																}
																className="rounded-full px-3 py-1"
															>
																{isMonthlyPrimary ? "Primary" : "Optional"}
															</Badge>
															<Badge
																variant="outline"
																className="rounded-full px-3 py-1"
															>
																{rate.mileagePolicy.mileageType}
															</Badge>
														</div>
														<Button
															type="button"
															variant="outline"
															onClick={() => onRemoveRate(rateIndex)}
															disabled={isMonthlyPrimary}
															className="h-10 w-full justify-start rounded-2xl"
														>
															{isMonthlyPrimary
																? "Primary required"
																: "Remove rate"}
														</Button>
													</div>

													<div className="space-y-5">
														<Field>
															<FieldLabel>Pricing model</FieldLabel>
															<ToggleGroup
																type="single"
																value={rate.pricingModel}
																onValueChange={(value) => {
																	if (!value) {
																		return
																	}
																	onRateModelChange(
																		rateIndex,
																		value as PricingModel,
																	)
																}}
																className="flex w-full flex-wrap gap-2"
															>
																{pricingModels.map((pricingModel) => (
																	<ToggleGroupItem
																		key={pricingModel}
																		value={pricingModel}
																		disabled={isUsedByAnotherRate(pricingModel)}
																		className="h-11 min-w-30 px-3"
																	>
																		{pricingModel}
																	</ToggleGroupItem>
																))}
															</ToggleGroup>
														</Field>

														<div className="grid gap-4 md:grid-cols-2">
															<Field>
																<FieldLabel
																	htmlFor={`rate-amount-${rateIndex}`}
																>
																	Rate
																</FieldLabel>
																<InputGroup className="h-12">
																	<InputGroupInput
																		id={`rate-amount-${rateIndex}`}
																		type="number"
																		min={0}
																		step="0.01"
																		value={String(rate.rate)}
																		onChange={(event) =>
																			updateRateAtIndex(rateIndex, {
																				rate: Number(event.target.value || 0),
																			})
																		}
																		className="h-full"
																	/>
																	<InputGroupAddon align="inline-end">
																		<InputGroupText>USD</InputGroupText>
																	</InputGroupAddon>
																</InputGroup>
															</Field>

															<div className="rounded-[24px] border bg-background/80 p-4">
																<Field
																	orientation="horizontal"
																	className="items-center justify-between gap-4"
																>
																	<div>
																		<FieldLabel
																			htmlFor={`limited-mileage-${rateIndex}`}
																		>
																			Limited mileage
																		</FieldLabel>
																		<p className="text-muted-foreground mt-1 text-sm">
																			Default is unlimited mileage.
																		</p>
																	</div>
																	<Switch
																		id={`limited-mileage-${rateIndex}`}
																		checked={
																			rate.mileagePolicy.mileageType ===
																			"Limited"
																		}
																		onCheckedChange={(checked) =>
																			updateRateAtIndex(rateIndex, {
																				mileagePolicy: checked
																					? limitedMileagePolicy
																					: { mileageType: "Unlimited" },
																			})
																		}
																	/>
																</Field>
															</div>
														</div>

														{rate.mileagePolicy.mileageType === "Limited" ? (
															<div className="grid gap-4 rounded-[24px] border bg-background/80 p-4 md:grid-cols-3">
																<Field>
																	<FieldLabel
																		htmlFor={`limit-per-day-${rateIndex}`}
																	>
																		Daily limit
																	</FieldLabel>
																	<InputGroup className="h-12">
																		<InputGroupInput
																			id={`limit-per-day-${rateIndex}`}
																			type="number"
																			min={1}
																			value={String(
																				limitedMileagePolicy.limitPerDay,
																			)}
																			onChange={(event) =>
																				updateRateAtIndex(rateIndex, {
																					mileagePolicy: {
																						mileageType: "Limited",
																						limitPerDay: Number(
																							event.target.value || 1,
																						),
																						overageFeePerUnit:
																							limitedMileagePolicy.overageFeePerUnit,
																						measureUnit:
																							limitedMileagePolicy.measureUnit,
																					},
																				})
																			}
																			className="h-full"
																		/>
																		<InputGroupAddon align="inline-end">
																			<InputGroupText>
																				{limitedMileagePolicy.measureUnit}
																			</InputGroupText>
																		</InputGroupAddon>
																	</InputGroup>
																</Field>

																<Field>
																	<FieldLabel
																		htmlFor={`overage-fee-${rateIndex}`}
																	>
																		Overage fee / unit
																	</FieldLabel>
																	<InputGroup className="h-12">
																		<InputGroupInput
																			id={`overage-fee-${rateIndex}`}
																			type="number"
																			min={0}
																			step="0.01"
																			value={String(
																				limitedMileagePolicy.overageFeePerUnit,
																			)}
																			onChange={(event) =>
																				updateRateAtIndex(rateIndex, {
																					mileagePolicy: {
																						mileageType: "Limited",
																						limitPerDay:
																							limitedMileagePolicy.limitPerDay,
																						overageFeePerUnit: Number(
																							event.target.value || 0,
																						),
																						measureUnit:
																							limitedMileagePolicy.measureUnit,
																					},
																				})
																			}
																			className="h-full"
																		/>
																		<InputGroupAddon align="inline-end">
																			<InputGroupText>USD</InputGroupText>
																		</InputGroupAddon>
																	</InputGroup>
																</Field>

																<Field>
																	<FieldLabel>Unit</FieldLabel>
																	<ToggleGroup
																		type="single"
																		value={limitedMileagePolicy.measureUnit}
																		onValueChange={(value) => {
																			if (!value) {
																				return
																			}
																			updateRateAtIndex(rateIndex, {
																				mileagePolicy: {
																					mileageType: "Limited",
																					limitPerDay:
																						limitedMileagePolicy.limitPerDay,
																					overageFeePerUnit:
																						limitedMileagePolicy.overageFeePerUnit,
																					measureUnit: value as DistanceUnit,
																				},
																			})
																		}}
																		className="flex w-full gap-2"
																	>
																		<ToggleGroupItem
																			value="km"
																			className="h-11 flex-1"
																		>
																			km
																		</ToggleGroupItem>
																		<ToggleGroupItem
																			value="miles"
																			className="h-11 flex-1"
																		>
																			miles
																		</ToggleGroupItem>
																	</ToggleGroup>
																</Field>
															</div>
														) : null}

														<div className="rounded-[24px] border bg-background/80 p-4">
															<Field
																orientation="horizontal"
																className="items-center justify-between gap-4"
															>
																<div>
																	<FieldLabel
																		htmlFor={`requires-deposit-${rateIndex}`}
																	>
																		Security deposit
																	</FieldLabel>
																	<p className="text-muted-foreground mt-1 text-sm">
																		Require an upfront deposit for this model.
																	</p>
																</div>
																<Switch
																	id={`requires-deposit-${rateIndex}`}
																	checked={rate.requiresDeposit}
																	onCheckedChange={(checked) =>
																		updateRateAtIndex(rateIndex, {
																			requiresDeposit: checked,
																			depositAmount: checked
																				? (rate.depositAmount ?? 0)
																				: undefined,
																		})
																	}
																/>
															</Field>
														</div>

														{rate.requiresDeposit ? (
															<Field>
																<FieldLabel
																	htmlFor={`deposit-amount-${rateIndex}`}
																>
																	Deposit amount
																</FieldLabel>
																<InputGroup className="h-12">
																	<InputGroupInput
																		id={`deposit-amount-${rateIndex}`}
																		type="number"
																		min={0}
																		step="0.01"
																		value={String(rate.depositAmount ?? 0)}
																		onChange={(event) =>
																			updateRateAtIndex(rateIndex, {
																				depositAmount: Number(
																					event.target.value || 0,
																				),
																			})
																		}
																		className="h-full"
																	/>
																	<InputGroupAddon align="inline-end">
																		<InputGroupText>USD</InputGroupText>
																	</InputGroupAddon>
																</InputGroup>
															</Field>
														) : null}
													</div>
												</div>
											</div>
										)
									})}

									<div className="rounded-[28px] border border-dashed bg-background/80 p-6 text-center">
										<p className="text-sm font-semibold">
											Add another pricing model
										</p>
										<p className="text-muted-foreground mt-2 text-sm">
											Configure only the models you actively rent with. Monthly
											stays required as the primary base.
										</p>
										<Button
											type="button"
											variant="outline"
											className="mt-4 h-11 rounded-2xl"
											onClick={onAddRate}
											disabled={availablePricingModels.length === 0}
										>
											Add rate
										</Button>
										<p className="text-muted-foreground mt-3 text-xs">
											{availablePricingModels.length === 0
												? "All pricing models are already configured."
												: `Available: ${availablePricingModels.join(" • ")}`}
										</p>
									</div>
								</div>
							</FieldGroup>
						) : null}
					</div>
				</div>

				<DrawerFooter className="shrink-0 border-t bg-background/90 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
					<div className="mx-auto flex w-full max-w-[1560px] flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
						<Button
							type="button"
							variant="outline"
							className="h-12 rounded-2xl px-5"
							onClick={() => {
								if (drawerStep === 0) {
									onOpenChange(false)
									return
								}
								onPreviousStep()
							}}
							disabled={createVehiclePending || uploadImagesPending}
						>
							{drawerStep === 0 ? "Close" : "Back"}
						</Button>

						<div className="flex items-center gap-3">
							<p className="hidden text-sm text-muted-foreground md:block">
								Step {drawerStep + 1} of {totalDrawerSteps}
							</p>
							{drawerStep === totalDrawerSteps - 1 ? (
								<Button
									type="button"
									className="h-12 rounded-2xl px-6"
									onClick={onSubmitVehicle}
									disabled={createVehiclePending || uploadImagesPending}
								>
									{createVehiclePending ? "Saving..." : "Create vehicle"}
								</Button>
							) : (
								<Button
									type="button"
									className="h-12 rounded-2xl px-6"
									onClick={onNextStep}
									disabled={uploadImagesPending}
								>
									Next
								</Button>
							)}
						</div>
					</div>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	)
}
