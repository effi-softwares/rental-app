"use client"

import {
	Archive,
	BatteryCharging,
	Calendar,
	CalendarDays,
	CalendarRange,
	CheckCircle2,
	Circle,
	Compass,
	Droplets,
	Fuel,
	Gauge,
	KeyRound,
	Leaf,
	LoaderCircle,
	type LucideIcon,
	MoveLeft,
	MoveRight,
	Route,
	Ruler,
	Settings2,
	Truck,
	Wrench,
	Zap,
} from "lucide-react"

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
	DrawerDateInput,
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
import {
	completedStepIndicatorClassName,
	feedbackMessageClassName,
	statusTextClassName,
} from "@/lib/theme-styles"
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
	title: string
	description: string
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
	submitPending: boolean
	submitLabel: string
	submitPendingLabel: string
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

const wizardSurfaceClassName = "border-t border-border/60 pt-5 sm:pt-6"

const wizardInsetClassName = "border-t border-border/50"

const wizardColumnDividerClassName = "xl:border-l xl:border-border/60 xl:pl-6"

const wizardToggleGroupClassName = "flex w-full flex-nowrap gap-2"

const wizardToggleGroupItemClassName =
	"h-14 min-w-0 flex-1 justify-center !rounded-lg group-data-[spacing=0]/toggle-group:!rounded-lg border border-border bg-background px-4 text-center font-medium whitespace-normal leading-tight text-foreground shadow-none transition-[background-color,border-color,color,box-shadow] duration-200 hover:bg-background data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-[0_0_0_1px_hsl(var(--primary))] sm:px-5"

const transmissionIcons: Record<Transmission, LucideIcon> = {
	Automatic: Gauge,
	Manual: Wrench,
	"Semi-Automatic": Settings2,
}

const fuelTypeIcons: Record<FuelType, LucideIcon> = {
	Petrol: Fuel,
	Diesel: Truck,
	Electric: BatteryCharging,
	Hybrid: Leaf,
	Hydrogen: Droplets,
}

const drivetrainIcons: Record<Drivetrain, LucideIcon> = {
	FWD: MoveRight,
	RWD: MoveLeft,
	AWD: Compass,
	"4WD": Route,
	"Electric-Single": Zap,
	"Electric-Dual": BatteryCharging,
}

const vehicleStatusIcons: Record<VehicleStatus, LucideIcon> = {
	Available: CheckCircle2,
	Rented: KeyRound,
	Maintenance: Wrench,
	Retired: Archive,
}

const pricingModelIcons: Record<PricingModel, LucideIcon> = {
	Daily: CalendarDays,
	Weekly: CalendarRange,
	Monthly: Calendar,
	"Distance-Based": Route,
}

const distanceUnitIcons: Record<DistanceUnit, LucideIcon> = {
	km: Ruler,
	miles: Route,
}

function WizardToggleButtonContent({
	label,
	icon: Icon,
}: {
	label: string
	icon: LucideIcon
}) {
	return (
		<span className="flex min-w-0 flex-col items-center justify-center gap-1">
			<Icon className="size-4 shrink-0" />
			<span className="min-w-0 text-[11px] leading-tight sm:text-xs">
				{label}
			</span>
		</span>
	)
}

function StepRailItem({
	index,
	active,
	completed,
	isLast,
}: {
	index: number
	active: boolean
	completed: boolean
	isLast: boolean
}) {
	return (
		<div className="flex items-center gap-2">
			<div
				className={cn(
					"flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-muted-foreground",
					completed && completedStepIndicatorClassName,
					active &&
						!completed &&
						"border-primary bg-primary text-primary-foreground",
				)}
			>
				{completed ? <CheckCircle2 className="size-3.5" /> : index + 1}
			</div>
			{!isLast ? (
				<div
					className={cn(
						"h-px w-8 shrink-0 bg-border sm:w-10",
						completed && "bg-emerald-500/40",
						active && !completed && "bg-primary/30",
					)}
				/>
			) : null}
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
		<div className={cn(wizardSurfaceClassName, "space-y-5 p-5 sm:p-6")}>
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
				{imagePreviewGroups.map((group, index) => {
					const isActive = group.key === activeImageGroup
					const complete = group.assets.length > 0
					return (
						<div
							key={group.key}
							className={cn(
								index === 0 ? "pt-0" : wizardInsetClassName,
								"px-1 py-3",
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
										<CheckCircle2
											className={cn("size-4", statusTextClassName("success"))}
										/>
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
		</div>
	)
}

export function VehicleCreateWizardDrawer({
	open,
	onOpenChange,
	title,
	description,
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
	submitPending,
	submitLabel,
	submitPendingLabel,
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

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent fullHeight className="overflow-hidden bg-sidebar">
				<div className="shrink-0 border-b bg-sidebar">
					<DrawerHeader className="mx-auto w-full max-w-7xl px-4 pb-3 pt-4 text-left sm:px-6 lg:px-8">
						<div className="min-w-0 space-y-2">
							<DrawerTitle className="text-xl font-semibold tracking-tight">
								{title}
							</DrawerTitle>
							<DrawerDescription className="max-w-3xl text-xs sm:text-sm">
								{description}
							</DrawerDescription>
						</div>
					</DrawerHeader>
					<div className="mx-auto w-full max-w-7xl mt-6 mb-3 px-4 pb-4 sm:px-6 lg:px-8">
						<div className="flex items-center overflow-x-auto pb-1">
							{steps.map((item, index) => (
								<StepRailItem
									key={item.title}
									index={index}
									active={drawerStep === index}
									completed={index < drawerStep}
									isLast={index === steps.length - 1}
								/>
							))}
						</div>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
						{formError ? (
							<p className={feedbackMessageClassName("danger")}>{formError}</p>
						) : null}

						{drawerStep === 0 ? (
							<FieldGroup className="space-y-6">
								<div className="">
									<div
										className={cn(
											wizardSurfaceClassName,
											"space-y-6 p-5 sm:p-6",
										)}
									>
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

										<div className={cn(wizardInsetClassName, "p-4")}>
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
								</div>
							</FieldGroup>
						) : null}

						{drawerStep >= 1 && drawerStep <= 3 && activeImageGroup ? (
							<FieldGroup className="space-y-6">
								<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
									<div
										className={cn(
											wizardSurfaceClassName,
											"space-y-6 p-5 sm:p-6",
										)}
									>
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

									<div
										className={cn("space-y-6", wizardColumnDividerClassName)}
									>
										<ImageProgressCard
											activeImageGroup={activeImageGroup}
											imageGroupLabels={imageGroupLabels}
											imagePreviewGroups={imagePreviewGroups}
											uploadedImageCount={uploadedImageCount}
											uploadImagesPending={uploadImagesPending}
										/>
									</div>
								</div>
							</FieldGroup>
						) : null}

						{drawerStep === 4 ? (
							<FieldGroup className="space-y-6">
								<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
									<div className="space-y-6">
										<div
											className={cn(
												wizardSurfaceClassName,
												"space-y-5 p-5 sm:p-6",
											)}
										>
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
													className={wizardToggleGroupClassName}
												>
													{transmissions.map((transmission) => (
														<ToggleGroupItem
															key={transmission}
															value={transmission}
															className={wizardToggleGroupItemClassName}
														>
															<WizardToggleButtonContent
																label={transmission}
																icon={transmissionIcons[transmission]}
															/>
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
													className={wizardToggleGroupClassName}
												>
													{fuelTypes.map((fuelType) => (
														<ToggleGroupItem
															key={fuelType}
															value={fuelType}
															className={wizardToggleGroupItemClassName}
														>
															<WizardToggleButtonContent
																label={fuelType}
																icon={fuelTypeIcons[fuelType]}
															/>
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
													className={wizardToggleGroupClassName}
												>
													{drivetrains.map((drivetrain) => (
														<ToggleGroupItem
															key={drivetrain}
															value={drivetrain}
															className={wizardToggleGroupItemClassName}
														>
															<WizardToggleButtonContent
																label={drivetrain}
																icon={drivetrainIcons[drivetrain]}
															/>
														</ToggleGroupItem>
													))}
												</ToggleGroup>
											</Field>
										</div>

										<div
											className={cn(
												wizardSurfaceClassName,
												"space-y-5 p-5 sm:p-6",
											)}
										>
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

									<div
										className={cn("space-y-6", wizardColumnDividerClassName)}
									>
										<div
											className={cn(
												wizardSurfaceClassName,
												"space-y-5 p-5 sm:p-6",
											)}
										>
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
														className={cn(wizardInsetClassName, "p-4")}
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
									</div>
								</div>
							</FieldGroup>
						) : null}

						{drawerStep === 5 ? (
							<FieldGroup className="space-y-6">
								<div className="space-y-6">
									<div
										className={cn(
											wizardSurfaceClassName,
											"space-y-5 p-5 sm:p-6",
										)}
									>
										<div>
											<p className="text-sm font-semibold">Fleet status</p>
											<p className="text-muted-foreground mt-1 text-sm">
												Set the availability state that downstream rental flows
												and the catalog should respect.
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
												className={wizardToggleGroupClassName}
											>
												{vehicleStatuses.map((status) => (
													<ToggleGroupItem
														key={status}
														value={status}
														className={wizardToggleGroupItemClassName}
													>
														<WizardToggleButtonContent
															label={status}
															icon={vehicleStatusIcons[status]}
														/>
													</ToggleGroupItem>
												))}
											</ToggleGroup>
										</Field>
									</div>

									<div
										className={cn(
											wizardSurfaceClassName,
											"space-y-5 p-5 sm:p-6",
										)}
									>
										<div>
											<p className="text-sm font-semibold">Compliance dates</p>
											<p className="text-muted-foreground mt-1 text-sm">
												Registration and insurance dates should be current
												before the vehicle starts appearing in active inventory.
											</p>
										</div>
										<div className="grid gap-5 md:grid-cols-2">
											<Field>
												<FieldLabel>Registration expiry</FieldLabel>
												<DrawerDateInput
													value={formValues.operations.registrationExpiryDate}
													placeholder="Select registration expiry"
													drawerTitle="Select registration expiry"
													drawerDescription="Choose the registration expiry date using the wheel selector."
													onValueChange={(value) =>
														updateOperations({
															registrationExpiryDate: value,
														})
													}
												/>
											</Field>
											<Field>
												<FieldLabel>Insurance expiry</FieldLabel>
												<DrawerDateInput
													value={formValues.operations.insuranceExpiryDate}
													placeholder="Select insurance expiry"
													drawerTitle="Select insurance expiry"
													drawerDescription="Choose the insurance expiry date using the wheel selector."
													onValueChange={(value) =>
														updateOperations({
															insuranceExpiryDate: value,
														})
													}
												/>
											</Field>
										</div>
									</div>
								</div>

								<div className="space-y-6">
									<div
										className={cn(
											wizardSurfaceClassName,
											"space-y-5 p-5 sm:p-6",
										)}
									>
										<div>
											<p className="text-sm font-semibold">Insurance record</p>
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
								</div>
							</FieldGroup>
						) : null}

						{drawerStep === 6 ? (
							<FieldGroup className="space-y-6">
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
													wizardSurfaceClassName,
													"space-y-5 p-5 sm:p-6",
												)}
											>
												<div className="flex flex-col gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-start sm:justify-between">
													<div className="space-y-3">
														<div className="flex flex-wrap items-center gap-2">
															<p className="text-sm font-semibold">
																{rate.pricingModel} rental
															</p>
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
														<p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
															{isMonthlyPrimary
																? "This is the required primary pricing model for each vehicle."
																: "Use optional models only when they support a real booking path."}
														</p>
													</div>

													{!isMonthlyPrimary ? (
														<Button
															type="button"
															variant="destructive"
															onClick={() => onRemoveRate(rateIndex)}
															className="h-10 rounded-2xl px-4 sm:w-auto"
														>
															Remove rate
														</Button>
													) : null}
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
															className={wizardToggleGroupClassName}
														>
															{pricingModels.map((pricingModel) => (
																<ToggleGroupItem
																	key={pricingModel}
																	value={pricingModel}
																	disabled={isUsedByAnotherRate(pricingModel)}
																	className={wizardToggleGroupItemClassName}
																>
																	<WizardToggleButtonContent
																		label={pricingModel}
																		icon={pricingModelIcons[pricingModel]}
																	/>
																</ToggleGroupItem>
															))}
														</ToggleGroup>
													</Field>

													<div className="grid gap-4 md:grid-cols-2">
														<Field>
															<FieldLabel htmlFor={`rate-amount-${rateIndex}`}>
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

														<div className={cn(wizardInsetClassName, "p-4")}>
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
																		rate.mileagePolicy.mileageType === "Limited"
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
														<div
															className={cn(
																wizardInsetClassName,
																"grid gap-4 p-4 md:grid-cols-3",
															)}
														>
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
																	className={wizardToggleGroupClassName}
																>
																	<ToggleGroupItem
																		value="km"
																		className={wizardToggleGroupItemClassName}
																	>
																		<WizardToggleButtonContent
																			label="km"
																			icon={distanceUnitIcons.km}
																		/>
																	</ToggleGroupItem>
																	<ToggleGroupItem
																		value="miles"
																		className={wizardToggleGroupItemClassName}
																	>
																		<WizardToggleButtonContent
																			label="miles"
																			icon={distanceUnitIcons.miles}
																		/>
																	</ToggleGroupItem>
																</ToggleGroup>
															</Field>
														</div>
													) : null}

													<div className={cn(wizardInsetClassName, "p-4")}>
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
										)
									})}

									<div
										className={cn(wizardSurfaceClassName, "p-6 text-center")}
									>
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

				<DrawerFooter className="shrink-0 border-t bg-sidebar px-4 py-4 sm:px-6 lg:px-8">
					<div className="mx-auto flex w-full max-w-7xl flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
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
							disabled={submitPending || uploadImagesPending}
						>
							{drawerStep === 0 ? "Close" : "Back"}
						</Button>

						<div className="flex items-center gap-3">
							<p className="hidden rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-sm text-muted-foreground md:block">
								Step {drawerStep + 1} of {totalDrawerSteps}
							</p>
							{drawerStep === totalDrawerSteps - 1 ? (
								<Button
									type="button"
									className="h-12 rounded-2xl px-6"
									onClick={onSubmitVehicle}
									disabled={submitPending || uploadImagesPending}
								>
									{submitPending ? submitPendingLabel : submitLabel}
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
