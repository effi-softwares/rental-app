"use client"

import {
	CalendarClock,
	CarFront,
	CircleCheck,
	CircleX,
	Cog,
	ImageIcon,
	MapPinned,
	Pencil,
	ShieldCheck,
	Wallet,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { VehicleLiveLocationTab } from "@/components/fleet/vehicle-live-location-tab"
import { MediaImage } from "@/components/media/media-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import { Switch } from "@/components/ui/switch"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
	AppWheelPicker,
	type WheelPickerOption,
} from "@/components/ui/wheel-picker"
import { VehicleImageGroupUpload } from "@/components/vehicles/vehicle-image-group-upload"
import { routes } from "@/config/routes"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { useUploadImagesMutation } from "@/features/media"
import {
	type DistanceUnit,
	type Drivetrain,
	type FuelType,
	type PricingModel,
	type Transmission,
	useUpdateVehicleMutation,
	useVehicleCatalogMetaQuery,
	useVehicleDetailsQuery,
	type VehicleColor,
	type VehicleCreatePayload,
	type VehicleDetails as VehicleDetailsRecord,
	type VehicleImageAsset,
	type VehicleRatePayload,
	type VehicleStatus,
	vehicleSchema,
} from "@/features/vehicles"
import { resolveErrorMessage } from "@/lib/errors"
import { isPrivilegedFleetRole } from "@/lib/fleet/live"
import { statusTextClassName } from "@/lib/theme-styles"

type VehicleDetailsProps = {
	vehicleId: string
}

type VehicleImageGroupKey = "frontImages" | "backImages" | "interiorImages"

type EditorKey =
	| "identity-brand-model"
	| "identity-class"
	| "identity-body"
	| "identity-year"
	| "identity-vin"
	| "identity-plate"
	| "identity-color"
	| "identity-brand-new"
	| "spec-transmission"
	| "spec-fuel"
	| "spec-drivetrain"
	| "spec-seats"
	| "spec-doors"
	| "spec-baggage"
	| "spec-ac"
	| "spec-navigation"
	| "spec-bluetooth"
	| "spec-pet"
	| "op-status"
	| "op-registration"
	| "op-insurance"
	| "op-policy"
	| "rates"
	| "images-frontImages"
	| "images-backImages"
	| "images-interiorImages"

const transmissions: Transmission[] = ["Automatic", "Manual", "Semi-Automatic"]
const fuelTypes: FuelType[] = [
	"Petrol",
	"Diesel",
	"Electric",
	"Hybrid",
	"Hydrogen",
]
const drivetrains: Drivetrain[] = [
	"FWD",
	"RWD",
	"AWD",
	"4WD",
	"Electric-Single",
	"Electric-Dual",
]
const vehicleStatuses: VehicleStatus[] = [
	"Available",
	"Rented",
	"Maintenance",
	"Retired",
]
const pricingModels: PricingModel[] = [
	"Monthly",
	"Weekly",
	"Daily",
	"Distance-Based",
]

const colorPresets: VehicleColor[] = [
	{ name: "Black", label: "Black", hex: "#111827" },
	{ name: "White", label: "White", hex: "#F8FAFC" },
	{ name: "Silver", label: "Silver", hex: "#94A3B8" },
	{ name: "Gray", label: "Gray", hex: "#6B7280" },
	{ name: "Blue", label: "Blue", hex: "#2563EB" },
	{ name: "Red", label: "Red", hex: "#DC2626" },
	{ name: "Green", label: "Green", hex: "#16A34A" },
	{ name: "Yellow", label: "Yellow", hex: "#D97706" },
]

const imageGroupLabels: Record<
	VehicleImageGroupKey,
	{ title: string; description: string; field: string }
> = {
	frontImages: {
		title: "Front images",
		description: "Upload one or more front-view images.",
		field: "front",
	},
	backImages: {
		title: "Back images",
		description: "Upload one or more rear-view images.",
		field: "back",
	},
	interiorImages: {
		title: "Interior images",
		description: "Upload one or more interior-view images.",
		field: "interior",
	},
}

function toDateInputValue(value: string) {
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return ""
	}

	const month = String(parsed.getUTCMonth() + 1).padStart(2, "0")
	const day = String(parsed.getUTCDate()).padStart(2, "0")

	return `${parsed.getUTCFullYear()}-${month}-${day}`
}

function formatDateLabel(value?: string | null) {
	if (!value) {
		return "-"
	}

	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return "-"
	}

	return parsed.toLocaleDateString()
}

function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 2,
	}).format(value)
}

function statusBadgeVariant(
	status: VehicleStatus,
): "secondary" | "destructive" | "outline" {
	if (status === "Retired") {
		return "destructive"
	}

	if (status === "Maintenance") {
		return "outline"
	}

	return "secondary"
}

function sortImageAssets(assets: VehicleImageAsset[]) {
	return [...assets]
		.sort((left, right) => left.sortOrder - right.sortOrder)
		.map((asset, index) => ({ ...asset, sortOrder: index }))
}

function createDefaultRate(pricingModel: PricingModel): VehicleRatePayload {
	return {
		pricingModel,
		rate: 0,
		mileagePolicy: { mileageType: "Unlimited" },
		requiresDeposit: false,
		depositAmount: undefined,
	}
}

function ensureMonthlyPrimaryRate(rates: VehicleRatePayload[]) {
	const seen = new Set<PricingModel>()
	const deduped: VehicleRatePayload[] = []

	for (const rate of rates) {
		if (seen.has(rate.pricingModel)) {
			continue
		}

		seen.add(rate.pricingModel)
		deduped.push(rate)
	}

	if (!seen.has("Monthly")) {
		deduped.push(createDefaultRate("Monthly"))
	}

	return [...deduped].sort(
		(left, right) =>
			pricingModels.indexOf(left.pricingModel) -
			pricingModels.indexOf(right.pricingModel),
	)
}

function payloadFromDetails(
	details: VehicleDetailsRecord,
): VehicleCreatePayload {
	return {
		identity: {
			brandId: details.brandId,
			modelId: details.modelId,
			vehicleClassId: details.vehicleClassId ?? undefined,
			bodyTypeId: details.bodyTypeId ?? undefined,
			year: details.year,
			vin: details.vin,
			licensePlate: details.licensePlate,
			color: details.color,
			isBrandNew: details.isBrandNew,
		},
		images: {
			frontImages: sortImageAssets(details.images.frontImages),
			backImages: sortImageAssets(details.images.backImages),
			interiorImages: sortImageAssets(details.images.interiorImages),
		},
		specs: {
			transmission: details.transmission,
			fuelType: details.fuelType,
			drivetrain: details.drivetrain,
			seats: details.seats,
			doors: details.doors,
			baggageCapacity: details.baggageCapacity,
			features: {
				hasAC: details.hasAc,
				hasNavigation: details.hasNavigation,
				hasBluetooth: details.hasBluetooth,
				isPetFriendly: details.isPetFriendly,
			},
		},
		operations: {
			status: details.status,
			registrationExpiryDate: toDateInputValue(details.registrationExpiryDate),
			insuranceExpiryDate: toDateInputValue(details.insuranceExpiryDate),
			insurancePolicyNumber: details.insurancePolicyNumber,
		},
		rates: {
			rates: ensureMonthlyPrimaryRate(
				details.rates.length > 0
					? details.rates.map((rate) => ({
							pricingModel: rate.pricingModel,
							rate: rate.rate,
							mileagePolicy:
								rate.mileageType === "Limited"
									? {
											mileageType: "Limited",
											limitPerDay: rate.limitPerDay ?? 100,
											overageFeePerUnit: rate.overageFeePerUnit ?? 0,
											measureUnit: (rate.measureUnit ?? "km") as DistanceUnit,
										}
									: { mileageType: "Unlimited" },
							requiresDeposit: rate.requiresDeposit,
							depositAmount: rate.depositAmount ?? undefined,
						}))
					: [createDefaultRate("Monthly")],
			),
		},
	}
}

function FeatureRow({
	label,
	enabled,
	onEdit,
	canManage,
}: {
	label: string
	enabled: boolean
	onEdit: () => void
	canManage: boolean
}) {
	return (
		<div className="flex items-center justify-between border-b py-2">
			<p className="text-sm">{label}</p>
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-1.5 text-sm">
					{enabled ? (
						<CircleCheck
							className={`size-4 ${statusTextClassName("success")}`}
						/>
					) : (
						<CircleX className="size-4 text-muted-foreground" />
					)}
					<span
						className={
							enabled ? statusTextClassName("success") : "text-muted-foreground"
						}
					>
						{enabled ? "Enabled" : "Disabled"}
					</span>
				</div>
				{canManage ? (
					<Button type="button" variant="ghost" size="icon-sm" onClick={onEdit}>
						<Pencil />
						<span className="sr-only">Edit {label}</span>
					</Button>
				) : null}
			</div>
		</div>
	)
}

function ValueRow({
	label,
	value,
	onEdit,
	canManage,
}: {
	label: string
	value: string | React.ReactNode
	onEdit: () => void
	canManage: boolean
}) {
	return (
		<div className="flex items-center justify-between border-b py-2">
			<div className="space-y-0.5">
				<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
					{label}
				</p>
				<div className="text-sm font-medium">{value}</div>
			</div>
			{canManage ? (
				<Button type="button" variant="ghost" size="icon-sm" onClick={onEdit}>
					<Pencil />
					<span className="sr-only">Edit {label}</span>
				</Button>
			) : null}
		</div>
	)
}

export function VehicleDetails({ vehicleId }: VehicleDetailsProps) {
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined

	const detailsQuery = useVehicleDetailsQuery(activeOrganizationId, vehicleId)
	const metaQuery = useVehicleCatalogMetaQuery(activeOrganizationId)
	const updateVehicleMutation = useUpdateVehicleMutation(activeOrganizationId)
	const uploadImagesMutation = useUploadImagesMutation()
	const canViewLiveFleet = isPrivilegedFleetRole(
		authContextQuery.data?.viewer.role,
	)

	const [activeEditor, setActiveEditor] = useState<EditorKey | null>(null)
	const [editorError, setEditorError] = useState<string | null>(null)

	const [brandDraft, setBrandDraft] = useState("")
	const [modelDraft, setModelDraft] = useState("")
	const [vehicleClassDraft, setVehicleClassDraft] = useState("none")
	const [bodyTypeDraft, setBodyTypeDraft] = useState("none")
	const [yearDraft, setYearDraft] = useState<number>(() =>
		new Date().getFullYear(),
	)
	const [vinDraft, setVinDraft] = useState("")
	const [plateDraft, setPlateDraft] = useState("")
	const [colorDraft, setColorDraft] = useState<VehicleColor>(colorPresets[0])
	const [isBrandNewDraft, setIsBrandNewDraft] = useState(false)

	const [transmissionDraft, setTransmissionDraft] =
		useState<Transmission>("Automatic")
	const [fuelTypeDraft, setFuelTypeDraft] = useState<FuelType>("Petrol")
	const [drivetrainDraft, setDrivetrainDraft] = useState<Drivetrain>("FWD")
	const [seatsDraft, setSeatsDraft] = useState<number>(5)
	const [doorsDraft, setDoorsDraft] = useState<number>(4)
	const [baggageDraft, setBaggageDraft] = useState<number>(0)
	const [hasAcDraft, setHasAcDraft] = useState(false)
	const [hasNavigationDraft, setHasNavigationDraft] = useState(false)
	const [hasBluetoothDraft, setHasBluetoothDraft] = useState(false)
	const [isPetFriendlyDraft, setIsPetFriendlyDraft] = useState(false)

	const [statusDraft, setStatusDraft] = useState<VehicleStatus>("Available")
	const [registrationDraft, setRegistrationDraft] = useState("")
	const [insuranceDraft, setInsuranceDraft] = useState("")
	const [policyDraft, setPolicyDraft] = useState("")

	const [rateDrafts, setRateDrafts] = useState<VehicleRatePayload[]>([])
	const [imageDraftGroup, setImageDraftGroup] =
		useState<VehicleImageGroupKey>("frontImages")
	const [imageDraftAssets, setImageDraftAssets] = useState<VehicleImageAsset[]>(
		[],
	)
	const [uploadProgressByFile, setUploadProgressByFile] = useState<
		Record<string, number>
	>({})

	const record = detailsQuery.data
	const canManageVehicles = Boolean(metaQuery.data?.canManageVehicles)

	const brandOptions = useMemo(() => {
		return (metaQuery.data?.brands ?? []).map((brand) => ({
			value: brand.id,
			label: brand.name,
		}))
	}, [metaQuery.data?.brands])

	const modelOptions = useMemo(() => {
		return (metaQuery.data?.models ?? [])
			.filter((model) => model.brandId === brandDraft)
			.map((model) => ({ value: model.id, label: model.name }))
	}, [metaQuery.data?.models, brandDraft])

	const bodyTypeOptions = useMemo(() => {
		return [
			{ value: "none", label: "Not set" },
			...(metaQuery.data?.bodyTypes ?? []).map((bodyType) => ({
				value: bodyType.id,
				label: bodyType.name,
			})),
		]
	}, [metaQuery.data?.bodyTypes])

	const vehicleClassOptions = useMemo(() => {
		return [
			{ value: "none", label: "No class yet" },
			...(metaQuery.data?.vehicleClasses ?? []).map((vehicleClass) => ({
				value: vehicleClass.id,
				label: `${vehicleClass.name} (${vehicleClass.code})`,
			})),
		]
	}, [metaQuery.data?.vehicleClasses])

	const yearOptions = useMemo<WheelPickerOption<number>[]>(() => {
		const currentYear = new Date().getFullYear()
		return Array.from({ length: currentYear - 1989 }, (_, index) => {
			const year = currentYear + 1 - index
			return { value: year, label: String(year) }
		})
	}, [])

	const seatOptions = useMemo<WheelPickerOption<number>[]>(() => {
		return Array.from({ length: 12 }, (_, index) => {
			const value = index + 1
			return { value, label: `${value} seats` }
		})
	}, [])

	const doorOptions = useMemo<WheelPickerOption<number>[]>(() => {
		return Array.from({ length: 5 }, (_, index) => {
			const value = index + 2
			return { value, label: `${value} doors` }
		})
	}, [])

	const baggageOptions = useMemo<WheelPickerOption<number>[]>(() => {
		return Array.from({ length: 21 }, (_, index) => ({
			value: index,
			label: `${index} bags`,
		}))
	}, [])

	const usedPricingModels = useMemo(
		() => new Set(rateDrafts.map((rate) => rate.pricingModel)),
		[rateDrafts],
	)

	const availablePricingModels = useMemo(
		() => pricingModels.filter((model) => !usedPricingModels.has(model)),
		[usedPricingModels],
	)

	function resetDraftsFromRecord(target: VehicleDetailsRecord) {
		const payload = payloadFromDetails(target)

		setBrandDraft(payload.identity.brandId)
		setModelDraft(payload.identity.modelId)
		setVehicleClassDraft(payload.identity.vehicleClassId ?? "none")
		setBodyTypeDraft(payload.identity.bodyTypeId ?? "none")
		setYearDraft(payload.identity.year)
		setVinDraft(payload.identity.vin)
		setPlateDraft(payload.identity.licensePlate)
		setColorDraft(payload.identity.color)
		setIsBrandNewDraft(payload.identity.isBrandNew)

		setTransmissionDraft(payload.specs.transmission)
		setFuelTypeDraft(payload.specs.fuelType)
		setDrivetrainDraft(payload.specs.drivetrain)
		setSeatsDraft(payload.specs.seats)
		setDoorsDraft(payload.specs.doors)
		setBaggageDraft(payload.specs.baggageCapacity)
		setHasAcDraft(payload.specs.features.hasAC)
		setHasNavigationDraft(payload.specs.features.hasNavigation)
		setHasBluetoothDraft(payload.specs.features.hasBluetooth)
		setIsPetFriendlyDraft(payload.specs.features.isPetFriendly)

		setStatusDraft(payload.operations.status)
		setRegistrationDraft(payload.operations.registrationExpiryDate)
		setInsuranceDraft(payload.operations.insuranceExpiryDate)
		setPolicyDraft(payload.operations.insurancePolicyNumber)

		setRateDrafts(payload.rates.rates)
	}

	function openEditor(editor: EditorKey) {
		if (!record) {
			return
		}

		resetDraftsFromRecord(record)
		setEditorError(null)

		if (editor.startsWith("images-")) {
			const group = editor.replace("images-", "") as VehicleImageGroupKey
			setImageDraftGroup(group)
			setImageDraftAssets(sortImageAssets(record.images[group]))
			setUploadProgressByFile({})
		}

		setActiveEditor(editor)
	}

	async function savePayload(
		mutator: (payload: VehicleCreatePayload) => void,
		successMessage: string,
	) {
		if (!record) {
			return
		}

		const payload = payloadFromDetails(record)
		mutator(payload)

		const parsed = vehicleSchema.safeParse(payload)
		if (!parsed.success) {
			setEditorError(
				parsed.error.issues[0]?.message ?? "Invalid vehicle payload.",
			)
			return
		}

		setEditorError(null)

		try {
			await updateVehicleMutation.mutateAsync({
				vehicleId: record.id,
				payload: parsed.data,
			})
			toast.success(successMessage)
			setActiveEditor(null)
		} catch (error) {
			setEditorError(resolveErrorMessage(error, "Unable to update vehicle."))
		}
	}

	async function uploadImagesToDraft(files: File[]) {
		if (!record || !activeOrganizationId) {
			setEditorError("Missing organization or vehicle context for uploads.")
			return
		}

		const groupLabel = imageGroupLabels[imageDraftGroup]

		setEditorError(null)
		setUploadProgressByFile({})

		try {
			const uploaded = await uploadImagesMutation.mutateAsync({
				organizationId: activeOrganizationId,
				files,
				entityType: "vehicle",
				entityId: record.id,
				field: groupLabel.field,
				metadata: {
					source: "vehicle-details",
					group: groupLabel.field,
				},
				onFileProgress: (fileName, percentage) => {
					setUploadProgressByFile((previous) => ({
						...previous,
						[fileName]: percentage,
					}))
				},
			})

			const nextAssets: VehicleImageAsset[] = [
				...imageDraftAssets,
				...uploaded.map((asset, index) => {
					if (!asset.blurDataUrl) {
						throw new Error("Uploaded image is missing blur placeholder data.")
					}

					return {
						assetId: asset.assetId,
						url: asset.url,
						deliveryUrl: asset.deliveryUrl,
						blurDataUrl: asset.blurDataUrl,
						sortOrder: imageDraftAssets.length + index,
					}
				}),
			]

			setImageDraftAssets(sortImageAssets(nextAssets))
			toast.success(`${uploaded.length} image(s) uploaded.`)
		} catch (error) {
			setEditorError(resolveErrorMessage(error, "Unable to upload images."))
		} finally {
			setUploadProgressByFile({})
		}
	}

	if (!activeOrganizationId) {
		return (
			<section className="space-y-4">
				<PageSectionHeader
					title="Vehicle details"
					description="Select an active organization first."
					actions={
						<Button
							asChild
							type="button"
							size="lg"
							className="h-12"
							variant="outline"
						>
							<Link href={routes.app.vehicleCatalog}>Back to catalog</Link>
						</Button>
					}
				/>
			</section>
		)
	}

	if (detailsQuery.isPending) {
		return (
			<section className="space-y-4">
				<PageSectionHeader
					title="Vehicle details"
					description="Loading vehicle details..."
				/>
			</section>
		)
	}

	if (detailsQuery.isError || !record) {
		return (
			<section className="space-y-4">
				<PageSectionHeader
					title="Vehicle details"
					description="Unable to load vehicle details."
					actions={
						<Button
							asChild
							type="button"
							size="lg"
							className="h-12"
							variant="outline"
						>
							<Link href={routes.app.vehicleCatalog}>Back to catalog</Link>
						</Button>
					}
				/>
			</section>
		)
	}

	const frontImage = record.images.frontImages[0] ?? null

	const imageGroups: Array<{
		key: VehicleImageGroupKey
		title: string
		assets: VehicleImageAsset[]
	}> = [
		{
			key: "frontImages",
			title: "Front images",
			assets: record.images.frontImages,
		},
		{
			key: "backImages",
			title: "Back images",
			assets: record.images.backImages,
		},
		{
			key: "interiorImages",
			title: "Interior images",
			assets: record.images.interiorImages,
		},
	]

	const rateRows = ensureMonthlyPrimaryRate(rateDrafts)

	return (
		<section className="space-y-6">
			<PageSectionHeader
				title="Vehicle details"
				description="Review and update identity, specs, operations, pricing, and images."
				actions={
					<Button
						asChild
						type="button"
						size="lg"
						className="h-12"
						variant="outline"
					>
						<Link href={routes.app.vehicleCatalog}>Back to catalog</Link>
					</Button>
				}
			/>

			<div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
				<div className="flex min-w-0 items-center gap-3">
					<div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-full border">
						{frontImage ? (
							<MediaImage
								asset={{
									id: frontImage.assetId,
									deliveryUrl: frontImage.deliveryUrl,
									visibility: "private",
									blurDataUrl: frontImage.blurDataUrl,
									originalFileName: `${record.brandName}-${record.modelName}`,
									contentType: "image/jpeg",
								}}
								alt={`${record.brandName} ${record.modelName}`}
								fill
								sizes="64px"
								className="object-cover"
							/>
						) : (
							<div className="text-muted-foreground flex size-full items-center justify-center text-xs font-medium">
								<CarFront className="size-4" />
							</div>
						)}
					</div>

					<div className="min-w-0 space-y-1">
						<p className="truncate text-xl font-semibold">
							{record.year} {record.brandName} {record.modelName}
						</p>
						<p className="text-muted-foreground truncate text-sm">
							{record.licensePlate} • {record.fuelType} • {record.transmission}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Badge variant={statusBadgeVariant(record.status)}>
						{record.status}
					</Badge>
					{record.isBrandNew ? (
						<Badge variant="secondary">Brand new</Badge>
					) : null}
				</div>
			</div>

			<Tabs defaultValue="availability" className="space-y-0">
				<TabsList
					variant="line"
					className={`grid w-full grid-cols-2 gap-0 sm:grid-cols-3 ${canViewLiveFleet ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}
				>
					<TabsTrigger
						value="availability"
						className="justify-start lg:justify-center"
					>
						<CalendarClock className="size-4" />
						Availability
					</TabsTrigger>
					<TabsTrigger
						value="identity"
						className="justify-start lg:justify-center"
					>
						<CarFront className="size-4" />
						Identity
					</TabsTrigger>
					{canViewLiveFleet ? (
						<TabsTrigger
							value="live-location"
							className="justify-start lg:justify-center"
						>
							<MapPinned className="size-4" />
							Live location
						</TabsTrigger>
					) : null}
					<TabsTrigger
						value="specifications"
						className="justify-start lg:justify-center"
					>
						<Cog className="size-4" />
						Specifications
					</TabsTrigger>
					<TabsTrigger
						value="operations"
						className="justify-start lg:justify-center"
					>
						<ShieldCheck className="size-4" />
						Operations
					</TabsTrigger>
					<TabsTrigger
						value="rates"
						className="justify-start lg:justify-center"
					>
						<Wallet className="size-4" />
						Rates
					</TabsTrigger>
					<TabsTrigger
						value="images"
						className="justify-start lg:justify-center"
					>
						<ImageIcon className="size-4" />
						Images
					</TabsTrigger>
				</TabsList>

				<TabsContent value="availability">
					<div className="space-y-5 rounded-xl border p-4">
						<div className="space-y-1">
							<p className="text-lg font-semibold">Availability timeline</p>
							<p className="text-muted-foreground text-sm">
								Availability calendar and reservation flow will appear here once
								booking integration is enabled.
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-lg border border-dashed p-3">
								<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
									Current state
								</p>
								<p className="mt-2 text-sm font-medium">No schedule data yet</p>
							</div>
							<div className="rounded-lg border border-dashed p-3">
								<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
									Upcoming rentals
								</p>
								<p className="mt-2 text-sm font-medium">Placeholder</p>
							</div>
							<div className="rounded-lg border border-dashed p-3">
								<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
									Service windows
								</p>
								<p className="mt-2 text-sm font-medium">Placeholder</p>
							</div>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="identity">
					<div className="space-y-4 rounded-xl border p-4">
						<div>
							<p className="text-lg font-semibold">Vehicle identity</p>
							<p className="text-muted-foreground text-sm">
								Each identity field can be edited individually.
							</p>
						</div>

						<ValueRow
							label="Brand / model"
							value={`${record.brandName} / ${record.modelName}`}
							onEdit={() => openEditor("identity-brand-model")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Vehicle class"
							value={
								record.vehicleClassName && record.vehicleClassCode
									? `${record.vehicleClassName} (${record.vehicleClassCode})`
									: "Not set"
							}
							onEdit={() => openEditor("identity-class")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Body type"
							value={record.bodyTypeName ?? "Not set"}
							onEdit={() => openEditor("identity-body")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Year"
							value={String(record.year)}
							onEdit={() => openEditor("identity-year")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="VIN"
							value={record.vin}
							onEdit={() => openEditor("identity-vin")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="License plate"
							value={record.licensePlate}
							onEdit={() => openEditor("identity-plate")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Color"
							value={
								<div className="flex items-center gap-2">
									<span
										className="size-4 rounded-sm border"
										style={{ backgroundColor: record.color.hex }}
									/>
									<span>
										{record.color.label} ({record.color.hex.toUpperCase()})
									</span>
								</div>
							}
							onEdit={() => openEditor("identity-color")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Brand new"
							value={record.isBrandNew ? "Yes" : "No"}
							onEdit={() => openEditor("identity-brand-new")}
							canManage={canManageVehicles}
						/>
					</div>
				</TabsContent>

				{canViewLiveFleet ? (
					<TabsContent value="live-location">
						<VehicleLiveLocationTab
							vehicleId={vehicleId}
							organizationId={activeOrganizationId}
						/>
					</TabsContent>
				) : null}

				<TabsContent value="specifications">
					<div className="space-y-4 rounded-xl border p-4">
						<div>
							<p className="text-lg font-semibold">Specifications</p>
							<p className="text-muted-foreground text-sm">
								Each technical field is editable independently.
							</p>
						</div>

						<ValueRow
							label="Transmission"
							value={record.transmission}
							onEdit={() => openEditor("spec-transmission")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Fuel type"
							value={record.fuelType}
							onEdit={() => openEditor("spec-fuel")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Drivetrain"
							value={record.drivetrain}
							onEdit={() => openEditor("spec-drivetrain")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Seats"
							value={String(record.seats)}
							onEdit={() => openEditor("spec-seats")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Doors"
							value={String(record.doors)}
							onEdit={() => openEditor("spec-doors")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Baggage capacity"
							value={String(record.baggageCapacity)}
							onEdit={() => openEditor("spec-baggage")}
							canManage={canManageVehicles}
						/>

						<div className="space-y-1 pt-3">
							<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
								Features
							</p>
							<FeatureRow
								label="Air conditioning"
								enabled={record.hasAc}
								onEdit={() => openEditor("spec-ac")}
								canManage={canManageVehicles}
							/>
							<FeatureRow
								label="Navigation"
								enabled={record.hasNavigation}
								onEdit={() => openEditor("spec-navigation")}
								canManage={canManageVehicles}
							/>
							<FeatureRow
								label="Bluetooth"
								enabled={record.hasBluetooth}
								onEdit={() => openEditor("spec-bluetooth")}
								canManage={canManageVehicles}
							/>
							<FeatureRow
								label="Pet friendly"
								enabled={record.isPetFriendly}
								onEdit={() => openEditor("spec-pet")}
								canManage={canManageVehicles}
							/>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="operations">
					<div className="space-y-4 rounded-xl border p-4">
						<div>
							<p className="text-lg font-semibold">Operations & compliance</p>
							<p className="text-muted-foreground text-sm">
								Operational status and policy validity.
							</p>
						</div>
						<ValueRow
							label="Status"
							value={record.status}
							onEdit={() => openEditor("op-status")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Registration expiry"
							value={formatDateLabel(record.registrationExpiryDate)}
							onEdit={() => openEditor("op-registration")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Insurance expiry"
							value={formatDateLabel(record.insuranceExpiryDate)}
							onEdit={() => openEditor("op-insurance")}
							canManage={canManageVehicles}
						/>
						<ValueRow
							label="Policy number"
							value={record.insurancePolicyNumber}
							onEdit={() => openEditor("op-policy")}
							canManage={canManageVehicles}
						/>
						<div className="pt-2 text-xs text-muted-foreground">
							Created {formatDateLabel(record.createdAt)} • Updated{" "}
							{formatDateLabel(record.updatedAt)}
						</div>
					</div>
				</TabsContent>

				<TabsContent value="rates">
					<div className="space-y-4 rounded-xl border p-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="text-lg font-semibold">Pricing rates</p>
								<p className="text-muted-foreground text-sm">
									Rate set is edited as a single configuration.
								</p>
							</div>
							{canManageVehicles ? (
								<Button
									type="button"
									variant="outline"
									onClick={() => openEditor("rates")}
								>
									<Pencil />
									Edit rates
								</Button>
							) : null}
						</div>

						{record.rates.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No rates configured.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Model</TableHead>
										<TableHead>Rate</TableHead>
										<TableHead>Mileage policy</TableHead>
										<TableHead>Deposit</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{record.rates.map((rate) => (
										<TableRow key={rate.id}>
											<TableCell>
												<div className="flex items-center gap-2">
													<span className="font-medium">
														{rate.pricingModel}
													</span>
													{rate.pricingModel === "Monthly" ? (
														<Badge variant="secondary">Primary</Badge>
													) : null}
												</div>
											</TableCell>
											<TableCell className="font-medium">
												{formatCurrency(rate.rate)}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{rate.mileageType === "Unlimited"
													? "Unlimited"
													: `${rate.limitPerDay ?? 0} ${rate.measureUnit ?? "km"}/day • Overage ${formatCurrency(rate.overageFeePerUnit ?? 0)} per ${rate.measureUnit ?? "km"}`}
											</TableCell>
											<TableCell>
												{rate.requiresDeposit ? (
													<Badge variant="outline">
														{formatCurrency(rate.depositAmount ?? 0)}
													</Badge>
												) : (
													<span className="text-muted-foreground">
														Not required
													</span>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</div>
				</TabsContent>

				<TabsContent value="images">
					<div className="space-y-4 rounded-xl border p-4">
						<div>
							<p className="text-lg font-semibold">Image gallery</p>
							<p className="text-muted-foreground text-sm">
								Each image group can be edited independently.
							</p>
						</div>

						<Tabs
							defaultValue="frontImages"
							orientation="vertical"
							className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]"
						>
							<TabsList className="h-auto w-full flex-col items-stretch justify-start">
								{imageGroups.map((group) => (
									<TabsTrigger
										key={group.key}
										value={group.key}
										className="justify-between"
									>
										<span>{group.title}</span>
										<Badge variant="outline">{group.assets.length}</Badge>
									</TabsTrigger>
								))}
							</TabsList>

							{imageGroups.map((group) => (
								<TabsContent
									key={group.key}
									value={group.key}
									className="mt-0 space-y-3"
								>
									<div className="flex items-center justify-between gap-3">
										<p className="text-sm font-medium">{group.title}</p>
										{canManageVehicles ? (
											<Button
												type="button"
												variant="outline"
												onClick={() => openEditor(`images-${group.key}`)}
											>
												<Pencil />
												Edit group
											</Button>
										) : null}
									</div>

									{group.assets.length === 0 ? (
										<div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
											No images in this group.
										</div>
									) : (
										<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
											{group.assets.map((asset) => (
												<div
													key={asset.assetId}
													className="bg-muted/40 relative aspect-[4/3] overflow-hidden rounded-lg border"
												>
													<MediaImage
														asset={{
															id: asset.assetId,
															deliveryUrl: asset.deliveryUrl,
															visibility: "private",
															blurDataUrl: asset.blurDataUrl,
															originalFileName: `${group.title}-${asset.assetId}`,
															contentType: "image/jpeg",
														}}
														alt={group.title}
														fill
														sizes="(min-width: 1024px) 22vw, 45vw"
														className="object-cover"
													/>
												</div>
											))}
										</div>
									)}
								</TabsContent>
							))}
						</Tabs>
					</div>
				</TabsContent>
			</Tabs>

			<ResponsiveDrawer
				open={activeEditor === "identity-brand-model"}
				onOpenChange={(open) =>
					setActiveEditor(open ? "identity-brand-model" : null)
				}
				title="Edit brand and model"
				description="Brand and model are linked. Choose both together."
				desktopClassName="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
			>
				<FieldGroup>
					<div className="grid gap-4 md:grid-cols-2">
						<Field>
							<FieldLabel>Brand</FieldLabel>
							<AppWheelPicker
								value={brandDraft}
								onValueChange={(nextBrand) => {
									setBrandDraft(nextBrand)

									const nextBrandModels = (metaQuery.data?.models ?? []).filter(
										(model) => model.brandId === nextBrand,
									)
									const hasCurrentModel = nextBrandModels.some(
										(model) => model.id === modelDraft,
									)

									if (!hasCurrentModel) {
										setModelDraft(nextBrandModels[0]?.id ?? "")
									}
								}}
								options={brandOptions as WheelPickerOption<string>[]}
								visibleCount={12}
								optionItemHeight={42}
							/>
						</Field>

						<Field>
							<FieldLabel>Model</FieldLabel>
							{modelOptions.length > 0 ? (
								<AppWheelPicker
									value={
										modelOptions.some((option) => option.value === modelDraft)
											? modelDraft
											: (modelOptions[0]?.value ?? "")
									}
									onValueChange={setModelDraft}
									options={modelOptions as WheelPickerOption<string>[]}
									visibleCount={12}
									optionItemHeight={42}
								/>
							) : (
								<div className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
									No models available for the selected brand.
								</div>
							)}
						</Field>
					</div>
					{editorError ? (
						<p className="text-sm text-destructive">{editorError}</p>
					) : null}
					<Button
						type="button"
						className="h-11"
						onClick={() => {
							if (!brandDraft) {
								setEditorError("Please select a brand.")
								return
							}

							if (!modelDraft) {
								setEditorError("Please select a model.")
								return
							}

							void savePayload((payload) => {
								payload.identity.brandId = brandDraft
								payload.identity.modelId = modelDraft
							}, "Brand and model updated.")
						}}
						disabled={updateVehicleMutation.isPending}
					>
						Save brand and model
					</Button>
				</FieldGroup>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={activeEditor === "identity-class"}
				onOpenChange={(open) => setActiveEditor(open ? "identity-class" : null)}
				title="Edit vehicle class"
				description="Choose the rental class used for availability matching."
			>
				<FieldGroup>
					<AppWheelPicker
						value={vehicleClassDraft}
						onValueChange={setVehicleClassDraft}
						options={vehicleClassOptions as WheelPickerOption<string>[]}
						visibleCount={12}
						optionItemHeight={42}
					/>
					{editorError ? (
						<p className="text-sm text-destructive">{editorError}</p>
					) : null}
					<Button
						type="button"
						className="h-11"
						onClick={() => {
							void savePayload((payload) => {
								payload.identity.vehicleClassId =
									vehicleClassDraft === "none" ? undefined : vehicleClassDraft
							}, "Vehicle class updated.")
						}}
						disabled={updateVehicleMutation.isPending}
					>
						Save vehicle class
					</Button>
				</FieldGroup>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={activeEditor === "identity-body"}
				onOpenChange={(open) => setActiveEditor(open ? "identity-body" : null)}
				title="Edit body type"
				description="Choose the vehicle body type."
			>
				<FieldGroup>
					<AppWheelPicker
						value={bodyTypeDraft}
						onValueChange={setBodyTypeDraft}
						options={bodyTypeOptions as WheelPickerOption<string>[]}
						visibleCount={12}
						optionItemHeight={42}
					/>
					{editorError ? (
						<p className="text-sm text-destructive">{editorError}</p>
					) : null}
					<Button
						type="button"
						className="h-11"
						onClick={() => {
							void savePayload((payload) => {
								payload.identity.bodyTypeId =
									bodyTypeDraft === "none" ? undefined : bodyTypeDraft
							}, "Body type updated.")
						}}
						disabled={updateVehicleMutation.isPending}
					>
						Save body type
					</Button>
				</FieldGroup>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={activeEditor === "identity-year"}
				onOpenChange={(open) => setActiveEditor(open ? "identity-year" : null)}
				title="Edit year"
				description="Pick production year."
			>
				<FieldGroup>
					<AppWheelPicker
						value={yearDraft}
						onValueChange={setYearDraft}
						options={yearOptions}
						visibleCount={12}
						optionItemHeight={42}
					/>
					{editorError ? (
						<p className="text-sm text-destructive">{editorError}</p>
					) : null}
					<Button
						type="button"
						className="h-11"
						onClick={() => {
							void savePayload((payload) => {
								payload.identity.year = yearDraft
							}, "Year updated.")
						}}
						disabled={updateVehicleMutation.isPending}
					>
						Save year
					</Button>
				</FieldGroup>
			</ResponsiveDrawer>

			{[
				{
					key: "identity-vin" as const,
					title: "Edit VIN",
					description: "Update vehicle VIN.",
					value: vinDraft,
					setValue: setVinDraft,
					saveLabel: "Save VIN",
					onSave: () =>
						savePayload((payload) => {
							payload.identity.vin = vinDraft.trim()
						}, "VIN updated."),
				},
				{
					key: "identity-plate" as const,
					title: "Edit license plate",
					description: "Update registration plate.",
					value: plateDraft,
					setValue: setPlateDraft,
					saveLabel: "Save plate",
					onSave: () =>
						savePayload((payload) => {
							payload.identity.licensePlate = plateDraft.trim().toUpperCase()
						}, "License plate updated."),
				},
				{
					key: "op-policy" as const,
					title: "Edit policy number",
					description: "Update insurance policy reference.",
					value: policyDraft,
					setValue: setPolicyDraft,
					saveLabel: "Save policy",
					onSave: () =>
						savePayload((payload) => {
							payload.operations.insurancePolicyNumber = policyDraft.trim()
						}, "Policy number updated."),
				},
			].map((editor) => (
				<ResponsiveDrawer
					key={editor.key}
					open={activeEditor === editor.key}
					onOpenChange={(open) => setActiveEditor(open ? editor.key : null)}
					title={editor.title}
					description={editor.description}
				>
					<FieldGroup>
						<InputGroup className="h-11">
							<InputGroupInput
								value={editor.value}
								onChange={(event) => editor.setValue(event.target.value)}
								className="h-full"
							/>
						</InputGroup>
						{editorError ? (
							<p className="text-sm text-destructive">{editorError}</p>
						) : null}
						<Button
							type="button"
							className="h-11"
							onClick={() => {
								void editor.onSave()
							}}
							disabled={updateVehicleMutation.isPending}
						>
							{editor.saveLabel}
						</Button>
					</FieldGroup>
				</ResponsiveDrawer>
			))}

			<ResponsiveDrawer
				open={activeEditor === "identity-color"}
				onOpenChange={(open) => setActiveEditor(open ? "identity-color" : null)}
				title="Edit color"
				description="Pick one of the preset vehicle colors."
			>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{colorPresets.map((color) => (
							<button
								type="button"
								key={color.name}
								onClick={() => setColorDraft(color)}
								className={`h-20 rounded-xl border text-sm font-medium ${
									colorDraft.name === color.name
										? "ring-2 ring-foreground/60"
										: ""
								}`}
								style={{
									backgroundColor: color.hex,
									color: color.hex === "#F8FAFC" ? "#111827" : "#ffffff",
								}}
							>
								{color.label}
							</button>
						))}
					</div>
					{editorError ? (
						<p className="text-sm text-destructive">{editorError}</p>
					) : null}
					<Button
						type="button"
						className="h-11"
						onClick={() => {
							void savePayload((payload) => {
								payload.identity.color = colorDraft
							}, "Color updated.")
						}}
						disabled={updateVehicleMutation.isPending}
					>
						Save color
					</Button>
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={activeEditor === "identity-brand-new"}
				onOpenChange={(open) =>
					setActiveEditor(open ? "identity-brand-new" : null)
				}
				title="Edit brand-new status"
				description="Mark if vehicle is brand new."
			>
				<FieldGroup>
					<Field
						orientation="horizontal"
						className="items-center justify-between rounded-md border px-3 py-2"
					>
						<FieldLabel htmlFor="brand-new-switch">
							Brand new vehicle
						</FieldLabel>
						<Switch
							id="brand-new-switch"
							checked={isBrandNewDraft}
							onCheckedChange={setIsBrandNewDraft}
						/>
					</Field>
					{editorError ? (
						<p className="text-sm text-destructive">{editorError}</p>
					) : null}
					<Button
						type="button"
						className="h-11"
						onClick={() => {
							void savePayload((payload) => {
								payload.identity.isBrandNew = isBrandNewDraft
							}, "Brand-new status updated.")
						}}
						disabled={updateVehicleMutation.isPending}
					>
						Save
					</Button>
				</FieldGroup>
			</ResponsiveDrawer>

			{[
				{
					key: "spec-transmission" as const,
					title: "Edit transmission",
					value: transmissionDraft,
					setValue: setTransmissionDraft,
					values: transmissions,
					saveLabel: "Save transmission",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.transmission = transmissionDraft
						}, "Transmission updated."),
				},
				{
					key: "spec-fuel" as const,
					title: "Edit fuel type",
					value: fuelTypeDraft,
					setValue: setFuelTypeDraft,
					values: fuelTypes,
					saveLabel: "Save fuel type",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.fuelType = fuelTypeDraft
						}, "Fuel type updated."),
				},
				{
					key: "spec-drivetrain" as const,
					title: "Edit drivetrain",
					value: drivetrainDraft,
					setValue: setDrivetrainDraft,
					values: drivetrains,
					saveLabel: "Save drivetrain",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.drivetrain = drivetrainDraft
						}, "Drivetrain updated."),
				},
			].map((editor) => (
				<ResponsiveDrawer
					key={editor.key}
					open={activeEditor === editor.key}
					onOpenChange={(open) => setActiveEditor(open ? editor.key : null)}
					title={editor.title}
					description="Use toggle group to set this field."
				>
					<FieldGroup>
						<ToggleGroup
							type="single"
							value={editor.value}
							onValueChange={(value) => {
								if (!value) {
									return
								}

								editor.setValue(value as never)
							}}
							className="flex w-full flex-wrap gap-2"
						>
							{editor.values.map((value) => (
								<ToggleGroupItem
									key={value}
									value={value}
									className="h-10 px-3"
								>
									{value}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
						{editorError ? (
							<p className="text-sm text-destructive">{editorError}</p>
						) : null}
						<Button
							type="button"
							className="h-11"
							onClick={() => {
								void editor.onSave()
							}}
							disabled={updateVehicleMutation.isPending}
						>
							{editor.saveLabel}
						</Button>
					</FieldGroup>
				</ResponsiveDrawer>
			))}

			{[
				{
					key: "spec-seats" as const,
					title: "Edit seats",
					value: seatsDraft,
					setValue: setSeatsDraft,
					options: seatOptions,
					saveLabel: "Save seats",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.seats = seatsDraft
						}, "Seats updated."),
				},
				{
					key: "spec-doors" as const,
					title: "Edit doors",
					value: doorsDraft,
					setValue: setDoorsDraft,
					options: doorOptions,
					saveLabel: "Save doors",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.doors = doorsDraft
						}, "Doors updated."),
				},
				{
					key: "spec-baggage" as const,
					title: "Edit baggage",
					value: baggageDraft,
					setValue: setBaggageDraft,
					options: baggageOptions,
					saveLabel: "Save baggage",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.baggageCapacity = baggageDraft
						}, "Baggage capacity updated."),
				},
			].map((editor) => (
				<ResponsiveDrawer
					key={editor.key}
					open={activeEditor === editor.key}
					onOpenChange={(open) => setActiveEditor(open ? editor.key : null)}
					title={editor.title}
					description="Use wheel selector for precise value changes."
				>
					<FieldGroup>
						<AppWheelPicker
							value={editor.value}
							onValueChange={editor.setValue}
							options={editor.options}
							visibleCount={12}
							optionItemHeight={42}
						/>
						{editorError ? (
							<p className="text-sm text-destructive">{editorError}</p>
						) : null}
						<Button
							type="button"
							className="h-11"
							onClick={() => {
								void editor.onSave()
							}}
							disabled={updateVehicleMutation.isPending}
						>
							{editor.saveLabel}
						</Button>
					</FieldGroup>
				</ResponsiveDrawer>
			))}

			{[
				{
					key: "spec-ac" as const,
					title: "Edit air conditioning",
					value: hasAcDraft,
					setValue: setHasAcDraft,
					saveLabel: "Save A/C",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.features.hasAC = hasAcDraft
						}, "Air conditioning updated."),
				},
				{
					key: "spec-navigation" as const,
					title: "Edit navigation",
					value: hasNavigationDraft,
					setValue: setHasNavigationDraft,
					saveLabel: "Save navigation",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.features.hasNavigation = hasNavigationDraft
						}, "Navigation updated."),
				},
				{
					key: "spec-bluetooth" as const,
					title: "Edit bluetooth",
					value: hasBluetoothDraft,
					setValue: setHasBluetoothDraft,
					saveLabel: "Save bluetooth",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.features.hasBluetooth = hasBluetoothDraft
						}, "Bluetooth updated."),
				},
				{
					key: "spec-pet" as const,
					title: "Edit pet friendly",
					value: isPetFriendlyDraft,
					setValue: setIsPetFriendlyDraft,
					saveLabel: "Save pet policy",
					onSave: () =>
						savePayload((payload) => {
							payload.specs.features.isPetFriendly = isPetFriendlyDraft
						}, "Pet-friendly flag updated."),
				},
			].map((editor) => (
				<ResponsiveDrawer
					key={editor.key}
					open={activeEditor === editor.key}
					onOpenChange={(open) => setActiveEditor(open ? editor.key : null)}
					title={editor.title}
					description="Use switch to update feature availability."
				>
					<FieldGroup>
						<Field
							orientation="horizontal"
							className="items-center justify-between rounded-md border px-3 py-2"
						>
							<FieldLabel>{editor.title.replace("Edit ", "")}</FieldLabel>
							<Switch
								checked={editor.value}
								onCheckedChange={editor.setValue}
							/>
						</Field>
						{editorError ? (
							<p className="text-sm text-destructive">{editorError}</p>
						) : null}
						<Button
							type="button"
							className="h-11"
							onClick={() => {
								void editor.onSave()
							}}
							disabled={updateVehicleMutation.isPending}
						>
							{editor.saveLabel}
						</Button>
					</FieldGroup>
				</ResponsiveDrawer>
			))}

			<ResponsiveDrawer
				open={activeEditor === "op-status"}
				onOpenChange={(open) => setActiveEditor(open ? "op-status" : null)}
				title="Edit vehicle status"
				description="Choose current operational status."
			>
				<FieldGroup>
					<ToggleGroup
						type="single"
						value={statusDraft}
						onValueChange={(value) => {
							if (!value) {
								return
							}

							setStatusDraft(value as VehicleStatus)
						}}
						className="flex w-full flex-wrap gap-2"
					>
						{vehicleStatuses.map((status) => (
							<ToggleGroupItem
								key={status}
								value={status}
								className="h-10 px-3"
							>
								{status}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
					{editorError ? (
						<p className="text-sm text-destructive">{editorError}</p>
					) : null}
					<Button
						type="button"
						className="h-11"
						onClick={() => {
							void savePayload((payload) => {
								payload.operations.status = statusDraft
							}, "Vehicle status updated.")
						}}
						disabled={updateVehicleMutation.isPending}
					>
						Save status
					</Button>
				</FieldGroup>
			</ResponsiveDrawer>

			{[
				{
					key: "op-registration" as const,
					title: "Edit registration expiry",
					value: registrationDraft,
					setValue: setRegistrationDraft,
					saveLabel: "Save registration",
					onSave: () =>
						savePayload((payload) => {
							payload.operations.registrationExpiryDate = registrationDraft
						}, "Registration expiry updated."),
				},
				{
					key: "op-insurance" as const,
					title: "Edit insurance expiry",
					value: insuranceDraft,
					setValue: setInsuranceDraft,
					saveLabel: "Save insurance",
					onSave: () =>
						savePayload((payload) => {
							payload.operations.insuranceExpiryDate = insuranceDraft
						}, "Insurance expiry updated."),
				},
			].map((editor) => (
				<ResponsiveDrawer
					key={editor.key}
					open={activeEditor === editor.key}
					onOpenChange={(open) => setActiveEditor(open ? editor.key : null)}
					title={editor.title}
					description="Set a compliance date."
				>
					<FieldGroup>
						<InputGroup className="h-11">
							<InputGroupInput
								type="date"
								value={editor.value}
								onChange={(event) => editor.setValue(event.target.value)}
								className="h-full"
							/>
						</InputGroup>
						{editorError ? (
							<p className="text-sm text-destructive">{editorError}</p>
						) : null}
						<Button
							type="button"
							className="h-11"
							onClick={() => {
								void editor.onSave()
							}}
							disabled={updateVehicleMutation.isPending}
						>
							{editor.saveLabel}
						</Button>
					</FieldGroup>
				</ResponsiveDrawer>
			))}

			<ResponsiveDrawer
				open={activeEditor === "rates"}
				onOpenChange={(open) => setActiveEditor(open ? "rates" : null)}
				title="Edit pricing rates"
				description="Update monthly primary rate and optional models."
				desktopClassName="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
			>
				<div className="space-y-5">
					{rateRows.map((rate, index) => {
						const isMonthly = rate.pricingModel === "Monthly"
						const mileagePolicy =
							rate.mileagePolicy.mileageType === "Limited"
								? rate.mileagePolicy
								: {
										mileageType: "Limited" as const,
										limitPerDay: 150,
										overageFeePerUnit: 0,
										measureUnit: "km" as DistanceUnit,
									}

						const blockedModels = new Set(
							rateRows
								.filter((_item, rowIndex) => rowIndex !== index)
								.map((item) => item.pricingModel),
						)

						return (
							<div key={rate.pricingModel} className="space-y-3 border-b pb-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium">Rate {index + 1}</p>
										{isMonthly ? (
											<Badge variant="secondary">Primary</Badge>
										) : null}
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={isMonthly}
										onClick={() => {
											setRateDrafts((previous) =>
												ensureMonthlyPrimaryRate(
													previous.filter((_, rowIndex) => rowIndex !== index),
												),
											)
										}}
									>
										Remove
									</Button>
								</div>

								<Field>
									<FieldLabel>Pricing model</FieldLabel>
									<ToggleGroup
										type="single"
										value={rate.pricingModel}
										onValueChange={(value) => {
											if (!value) {
												return
											}

											const nextModel = value as PricingModel
											if (blockedModels.has(nextModel)) {
												setEditorError(
													`Only one ${nextModel.toLowerCase()} rate is allowed.`,
												)
												return
											}

											setEditorError(null)
											setRateDrafts((previous) =>
												ensureMonthlyPrimaryRate(
													previous.map((item, rowIndex) =>
														rowIndex === index
															? { ...item, pricingModel: nextModel }
															: item,
													),
												),
											)
										}}
										className="flex w-full flex-wrap gap-2"
									>
										{pricingModels.map((model) => (
											<ToggleGroupItem
												key={model}
												value={model}
												className="h-10 px-3"
												disabled={
													blockedModels.has(model) &&
													model !== rate.pricingModel
												}
											>
												{model}
											</ToggleGroupItem>
										))}
									</ToggleGroup>
								</Field>

								<Field>
									<FieldLabel>Rate amount</FieldLabel>
									<InputGroup className="h-11">
										<InputGroupAddon align="inline-start">
											<InputGroupText>USD</InputGroupText>
										</InputGroupAddon>
										<InputGroupInput
											type="number"
											min={0}
											step="0.01"
											value={String(rate.rate)}
											onChange={(event) => {
												const value = Number(event.target.value || 0)
												setRateDrafts((previous) =>
													previous.map((item, rowIndex) =>
														rowIndex === index
															? { ...item, rate: value }
															: item,
													),
												)
											}}
										/>
									</InputGroup>
								</Field>

								<Field
									orientation="horizontal"
									className="items-center justify-between rounded-md border px-3 py-2"
								>
									<FieldLabel>Mileage is limited</FieldLabel>
									<Switch
										checked={rate.mileagePolicy.mileageType === "Limited"}
										onCheckedChange={(checked) => {
											setRateDrafts((previous) =>
												previous.map((item, rowIndex) =>
													rowIndex === index
														? {
																...item,
																mileagePolicy: checked
																	? mileagePolicy
																	: { mileageType: "Unlimited" },
															}
														: item,
												),
											)
										}}
									/>
								</Field>

								{rate.mileagePolicy.mileageType === "Limited" ? (
									<div className="grid gap-3 md:grid-cols-3">
										<Field>
											<FieldLabel>Daily limit</FieldLabel>
											<InputGroup className="h-10">
												<InputGroupInput
													type="number"
													min={1}
													value={String(mileagePolicy.limitPerDay)}
													onChange={(event) => {
														const value = Number(event.target.value || 1)
														setRateDrafts((previous) =>
															previous.map((item, rowIndex) =>
																rowIndex === index &&
																item.mileagePolicy.mileageType === "Limited"
																	? {
																			...item,
																			mileagePolicy: {
																				...item.mileagePolicy,
																				limitPerDay: value,
																			},
																		}
																	: item,
															),
														)
													}}
												/>
											</InputGroup>
										</Field>

										<Field>
											<FieldLabel>Overage fee</FieldLabel>
											<InputGroup className="h-10">
												<InputGroupAddon align="inline-start">
													<InputGroupText>USD</InputGroupText>
												</InputGroupAddon>
												<InputGroupInput
													type="number"
													min={0}
													step="0.01"
													value={String(mileagePolicy.overageFeePerUnit)}
													onChange={(event) => {
														const value = Number(event.target.value || 0)
														setRateDrafts((previous) =>
															previous.map((item, rowIndex) =>
																rowIndex === index &&
																item.mileagePolicy.mileageType === "Limited"
																	? {
																			...item,
																			mileagePolicy: {
																				...item.mileagePolicy,
																				overageFeePerUnit: value,
																			},
																		}
																	: item,
															),
														)
													}}
												/>
											</InputGroup>
										</Field>

										<Field>
											<FieldLabel>Distance unit</FieldLabel>
											<ToggleGroup
												type="single"
												value={mileagePolicy.measureUnit}
												onValueChange={(value) => {
													if (!value) {
														return
													}

													setRateDrafts((previous) =>
														previous.map((item, rowIndex) =>
															rowIndex === index &&
															item.mileagePolicy.mileageType === "Limited"
																? {
																		...item,
																		mileagePolicy: {
																			...item.mileagePolicy,
																			measureUnit: value as DistanceUnit,
																		},
																	}
																: item,
														),
													)
												}}
												className="flex w-full gap-2"
											>
												<ToggleGroupItem value="km" className="h-10 flex-1">
													km
												</ToggleGroupItem>
												<ToggleGroupItem value="miles" className="h-10 flex-1">
													miles
												</ToggleGroupItem>
											</ToggleGroup>
										</Field>
									</div>
								) : null}

								<Field
									orientation="horizontal"
									className="items-center justify-between rounded-md border px-3 py-2"
								>
									<FieldLabel>Security deposit required</FieldLabel>
									<Switch
										checked={rate.requiresDeposit}
										onCheckedChange={(checked) => {
											setRateDrafts((previous) =>
												previous.map((item, rowIndex) =>
													rowIndex === index
														? {
																...item,
																requiresDeposit: checked,
																depositAmount: checked
																	? (item.depositAmount ?? 0)
																	: undefined,
															}
														: item,
												),
											)
										}}
									/>
								</Field>

								{rate.requiresDeposit ? (
									<Field>
										<FieldLabel>Deposit amount</FieldLabel>
										<InputGroup className="h-10">
											<InputGroupAddon align="inline-start">
												<InputGroupText>USD</InputGroupText>
											</InputGroupAddon>
											<InputGroupInput
												type="number"
												min={0}
												step="0.01"
												value={String(rate.depositAmount ?? 0)}
												onChange={(event) => {
													const value = Number(event.target.value || 0)
													setRateDrafts((previous) =>
														previous.map((item, rowIndex) =>
															rowIndex === index
																? { ...item, depositAmount: value }
																: item,
														),
													)
												}}
											/>
										</InputGroup>
									</Field>
								) : null}
							</div>
						)
					})}

					<div className="flex flex-wrap items-center justify-between gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								const nextModel = availablePricingModels[0]
								if (!nextModel) {
									setEditorError("All pricing models are already configured.")
									return
								}

								setEditorError(null)
								setRateDrafts((previous) =>
									ensureMonthlyPrimaryRate([
										...previous,
										createDefaultRate(nextModel),
									]),
								)
							}}
						>
							Add rate
						</Button>
						<Button
							type="button"
							className="h-11"
							onClick={() => {
								void savePayload((payload) => {
									payload.rates.rates = ensureMonthlyPrimaryRate(rateDrafts)
								}, "Rates updated.")
							}}
							disabled={updateVehicleMutation.isPending}
						>
							Save rates
						</Button>
					</div>

					{editorError ? (
						<p className="text-sm text-destructive">{editorError}</p>
					) : null}
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={Boolean(activeEditor?.startsWith("images-"))}
				onOpenChange={(open) => {
					if (!open) {
						setActiveEditor(null)
					}
				}}
				title={`Edit ${imageGroupLabels[imageDraftGroup].title.toLowerCase()}`}
				description="Upload or remove images in this group."
				desktopClassName="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
			>
				<div className="space-y-4">
					<VehicleImageGroupUpload
						title={imageGroupLabels[imageDraftGroup].title}
						description={imageGroupLabels[imageDraftGroup].description}
						assets={imageDraftAssets}
						isUploading={uploadImagesMutation.isPending}
						uploadProgressByFile={uploadProgressByFile}
						onFilesSelected={(files) => {
							void uploadImagesToDraft(files)
						}}
						onRemove={(assetId) => {
							setImageDraftAssets((previous) =>
								sortImageAssets(
									previous.filter((asset) => asset.assetId !== assetId),
								),
							)
						}}
					/>
					{editorError ? (
						<p className="text-sm text-destructive">{editorError}</p>
					) : null}
					<Button
						type="button"
						className="h-11"
						onClick={() => {
							void savePayload((payload) => {
								payload.images[imageDraftGroup] =
									sortImageAssets(imageDraftAssets)
							}, `${imageGroupLabels[imageDraftGroup].title} updated.`)
						}}
						disabled={
							updateVehicleMutation.isPending || uploadImagesMutation.isPending
						}
					>
						Save image group
					</Button>
				</div>
			</ResponsiveDrawer>
		</section>
	)
}
