"use client"

import { CheckCircle2, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { MediaImage } from "@/components/media/media-image"
import { RentalAppointmentDrawer } from "@/components/rentals/rental-appointment-drawer"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { PageSectionHeader } from "@/components/ui/page-section-header"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { VehicleCatalogTable } from "@/components/vehicles/vehicle-catalog-table"
import { VehicleCreateWizardDrawer } from "@/components/vehicles/vehicle-create-wizard-drawer"
import {
	ColorDrawerInput,
	DrawerSelectInput,
} from "@/components/vehicles/vehicle-form-picker-controls"
import { VehicleImageGroupUpload } from "@/components/vehicles/vehicle-image-group-upload"
import { routes } from "@/config/routes"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { useUploadImagesMutation } from "@/features/media"
import {
	type DistanceUnit,
	type Drivetrain,
	defaultVehicleFormValues,
	type FuelType,
	type PricingModel,
	type Transmission,
	useCreateVehicleMutation,
	useDeleteVehicleMutation,
	useUpdateVehicleMutation,
	useUpdateVehicleStatusMutation,
	useVehicleCatalogMetaQuery,
	useVehicleCatalogQuery,
	useVehicleDetailsQuery,
	type VehicleColor,
	type VehicleDetails,
	type VehicleFormValues,
	type VehicleImageAsset,
	type VehicleRatePayload,
	type VehicleStatus,
	vehicleIdentitySchema,
	vehicleOperationsSchema,
	vehicleRatesSchema,
	vehicleSchema,
	vehicleSpecsSchema,
} from "@/features/vehicles"
import { resolveErrorMessage } from "@/lib/errors"

const vehicleStatuses: VehicleStatus[] = [
	"Available",
	"Rented",
	"Maintenance",
	"Retired",
]
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
const pricingModels: PricingModel[] = [
	"Daily",
	"Weekly",
	"Monthly",
	"Distance-Based",
]

const defaultRate: VehicleRatePayload = {
	pricingModel: "Monthly",
	rate: 0,
	mileagePolicy: { mileageType: "Unlimited" },
	requiresDeposit: false,
	depositAmount: undefined,
}

const rateModelPriority: PricingModel[] = [
	"Monthly",
	"Weekly",
	"Daily",
	"Distance-Based",
]

function createDefaultRate(pricingModel: PricingModel): VehicleRatePayload {
	return {
		pricingModel,
		rate: 0,
		mileagePolicy: { mileageType: "Unlimited" },
		requiresDeposit: false,
		depositAmount: undefined,
	}
}

function sortRatesByPriority(rates: VehicleRatePayload[]) {
	const priorityMap = new Map(
		rateModelPriority.map((model, index) => [model, index]),
	)

	return [...rates].sort((left, right) => {
		const leftPriority =
			priorityMap.get(left.pricingModel) ?? Number.MAX_SAFE_INTEGER
		const rightPriority =
			priorityMap.get(right.pricingModel) ?? Number.MAX_SAFE_INTEGER

		if (leftPriority === rightPriority) {
			return left.pricingModel.localeCompare(right.pricingModel)
		}

		return leftPriority - rightPriority
	})
}

function ensureMonthlyPrimaryRate(rates: VehicleRatePayload[]) {
	const seenModels = new Set<PricingModel>()
	const dedupedRates: VehicleRatePayload[] = []

	for (const rate of rates) {
		if (seenModels.has(rate.pricingModel)) {
			continue
		}

		seenModels.add(rate.pricingModel)
		dedupedRates.push(rate)
	}

	if (!seenModels.has("Monthly")) {
		dedupedRates.push(createDefaultRate("Monthly"))
	}

	return sortRatesByPriority(dedupedRates)
}

const colorPresets: VehicleColor[] = [
	{ name: "Black", label: "Black", hex: "#111827" },
	{ name: "White", label: "White", hex: "#F8FAFC" },
	{ name: "Silver", label: "Silver", hex: "#9CA3AF" },
	{ name: "Gray", label: "Gray", hex: "#6B7280" },
	{ name: "Blue", label: "Blue", hex: "#2563EB" },
	{ name: "Red", label: "Red", hex: "#DC2626" },
	{ name: "Green", label: "Green", hex: "#16A34A" },
	{ name: "Brown", label: "Brown", hex: "#92400E" },
	{ name: "Yellow", label: "Yellow", hex: "#F5A623" },
	{ name: "Orange", label: "Orange", hex: "#EF6C00" },
	{ name: "Beige", label: "Beige", hex: "#C4BAB5" },
	{ name: "GoldChampagne", label: "Gold / Champagne", hex: "#C9B037" },
]

function toDateInputValue(isoDate: string) {
	const parsed = new Date(isoDate)
	if (Number.isNaN(parsed.getTime())) {
		return ""
	}

	return parsed.toISOString().slice(0, 10)
}

function normalizeImageGroupForForm(groupImages: VehicleImageAsset[]) {
	return [...groupImages]
		.sort((left, right) => left.sortOrder - right.sortOrder)
		.map((asset, index) => ({
			...asset,
			sortOrder: index,
		}))
}

function mapVehicleToFormValues(details: VehicleDetails): VehicleFormValues {
	const frontImages = normalizeImageGroupForForm(details.images.frontImages)
	const backImages = normalizeImageGroupForForm(details.images.backImages)
	const interiorImages = normalizeImageGroupForForm(
		details.images.interiorImages,
	)

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
			frontImages,
			backImages,
			interiorImages,
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
					: [defaultRate],
			),
		},
	}
}

type VehicleImageGroupKey = "frontImages" | "backImages" | "interiorImages"

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

const imageStepOrder: VehicleImageGroupKey[] = [
	"frontImages",
	"backImages",
	"interiorImages",
]

const drawerStepConfig = [
	{
		title: "Identity",
		description: "Brand, model, year, and registration details.",
	},
	{
		title: "Front images",
		description: "Upload front-angle vehicle photos.",
	},
	{
		title: "Back images",
		description: "Upload rear-angle vehicle photos.",
	},
	{
		title: "Interior images",
		description: "Upload cabin and interior photos.",
	},
	{
		title: "Specifications",
		description: "Transmission, fuel, and feature details.",
	},
	{
		title: "Operations",
		description: "Status and compliance details.",
	},
	{
		title: "Pricing rates",
		description: "Monthly primary rate plus optional pricing models.",
	},
] as const

export function VehicleCatalogManagement() {
	const router = useRouter()
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined

	const catalogQuery = useVehicleCatalogQuery(activeOrganizationId)
	const metaQuery = useVehicleCatalogMetaQuery(activeOrganizationId)

	const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
		null,
	)
	const [pendingEditVehicleId, setPendingEditVehicleId] = useState<
		string | null
	>(null)
	const detailsQuery = useVehicleDetailsQuery(
		activeOrganizationId,
		selectedVehicleId ?? undefined,
	)

	const createVehicleMutation = useCreateVehicleMutation(activeOrganizationId)
	const updateVehicleMutation = useUpdateVehicleMutation(activeOrganizationId)
	const updateVehicleStatusMutation =
		useUpdateVehicleStatusMutation(activeOrganizationId)
	const deleteVehicleMutation = useDeleteVehicleMutation(activeOrganizationId)
	const uploadImagesMutation = useUploadImagesMutation()

	const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
	const [isDrawerOpen, setIsDrawerOpen] = useState(false)
	const [isRentalDrawerOpen, setIsRentalDrawerOpen] = useState(false)
	const [rentalPreselectedVehicleId, setRentalPreselectedVehicleId] = useState<
		string | null
	>(null)
	const [drawerStep, setDrawerStep] = useState(0)
	const [createDraftId, setCreateDraftId] = useState<string | null>(null)
	const [uploadingGroup, setUploadingGroup] =
		useState<VehicleImageGroupKey | null>(null)
	const [uploadProgressByFile, setUploadProgressByFile] = useState<
		Record<string, number>
	>({})
	const [formValues, setFormValues] = useState<VehicleFormValues>(
		defaultVehicleFormValues,
	)
	const [formError, setFormError] = useState<string | null>(null)

	const [deleteTarget, setDeleteTarget] = useState<{
		id: string
		label: string
	} | null>(null)

	const [statusTarget, setStatusTarget] = useState<{
		id: string
		label: string
		status: VehicleStatus
	} | null>(null)

	const vehicles = catalogQuery.data?.vehicles ?? []
	const canManageVehicles =
		Boolean(catalogQuery.data?.canManageVehicles) ||
		Boolean(metaQuery.data?.canManageVehicles)
	const canCreateRentals = Boolean(
		authContextQuery.data?.permissions.viewBookingsModule,
	)
	const uploadEntityType = drawerMode === "create" ? "vehicle-draft" : "vehicle"
	const uploadEntityId =
		drawerMode === "create" ? createDraftId : selectedVehicleId

	useEffect(() => {
		if (vehicles.length === 0) {
			setSelectedVehicleId(null)
			return
		}

		const hasSelectedVehicle = vehicles.some(
			(vehicle) => vehicle.id === selectedVehicleId,
		)

		if (!hasSelectedVehicle) {
			setSelectedVehicleId(vehicles[0]?.id ?? null)
		}
	}, [vehicles, selectedVehicleId])

	useEffect(() => {
		if (!pendingEditVehicleId || !detailsQuery.data) {
			return
		}

		if (detailsQuery.data.id !== pendingEditVehicleId) {
			return
		}

		setDrawerMode("edit")
		setDrawerStep(0)
		setCreateDraftId(null)
		setUploadProgressByFile({})
		setUploadingGroup(null)
		setFormError(null)
		setFormValues(mapVehicleToFormValues(detailsQuery.data))
		setIsDrawerOpen(true)
		setPendingEditVehicleId(null)
	}, [pendingEditVehicleId, detailsQuery.data])

	useEffect(() => {
		if (!pendingEditVehicleId || detailsQuery.isPending) {
			return
		}

		if (detailsQuery.isError) {
			setFormError("Load vehicle details first before editing.")
			setPendingEditVehicleId(null)
		}
	}, [pendingEditVehicleId, detailsQuery.isPending, detailsQuery.isError])

	const rateEntries = formValues.rates.rates
	const selectedColor =
		colorPresets.find(
			(color) => color.name === formValues.identity.color.name,
		) ?? formValues.identity.color

	const usedPricingModels = useMemo(
		() => new Set(rateEntries.map((rate) => rate.pricingModel)),
		[rateEntries],
	)

	const availablePricingModels = useMemo(
		() =>
			rateModelPriority.filter(
				(pricingModel) => !usedPricingModels.has(pricingModel),
			),
		[usedPricingModels],
	)

	const brandOptions = useMemo(() => {
		const brands = metaQuery.data?.brands ?? []
		return brands.map((brand) => ({
			value: brand.id,
			label: brand.name,
		}))
	}, [metaQuery.data?.brands])

	const modelOptions = useMemo(() => {
		const models = metaQuery.data?.models ?? []
		const filteredModels = models.filter(
			(model) => model.brandId === formValues.identity.brandId,
		)

		return filteredModels.map((model) => ({
			value: model.id,
			label: model.name,
		}))
	}, [metaQuery.data?.models, formValues.identity.brandId])

	const bodyTypeOptions = useMemo(() => {
		const bodyTypes = metaQuery.data?.bodyTypes ?? []
		return [
			{ value: "none", label: "No body type" },
			...bodyTypes.map((bodyType) => ({
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

	const yearOptions = useMemo(() => {
		const currentYear = new Date().getFullYear() + 1
		const years = Array.from({ length: currentYear - 1994 }, (_, index) =>
			String(currentYear - index),
		)

		return years.map((year) => ({
			value: year,
			label: year,
		}))
	}, [])

	const seatOptions = useMemo(() => {
		return Array.from({ length: 12 }, (_, index) => {
			const value = index + 1
			return { value: String(value), label: String(value) }
		})
	}, [])

	const doorOptions = useMemo(() => {
		return Array.from({ length: 5 }, (_, index) => {
			const value = index + 2
			return { value: String(value), label: String(value) }
		})
	}, [])

	const baggageOptions = useMemo(() => {
		return Array.from({ length: 9 }, (_, index) => {
			return { value: String(index), label: String(index) }
		})
	}, [])

	function updateIdentity(nextValues: Partial<VehicleFormValues["identity"]>) {
		setFormValues((previous) => ({
			...previous,
			identity: {
				...previous.identity,
				...nextValues,
			},
		}))
	}

	function updateSpecs(nextValues: Partial<VehicleFormValues["specs"]>) {
		setFormValues((previous) => ({
			...previous,
			specs: {
				...previous.specs,
				...nextValues,
			},
		}))
	}

	function updateOperations(
		nextValues: Partial<VehicleFormValues["operations"]>,
	) {
		setFormValues((previous) => ({
			...previous,
			operations: {
				...previous.operations,
				...nextValues,
			},
		}))
	}

	function onFeatureChange(
		feature: keyof VehicleFormValues["specs"]["features"],
		checked: boolean,
	) {
		setFormValues((previous) => ({
			...previous,
			specs: {
				...previous.specs,
				features: {
					...previous.specs.features,
					[feature]: checked,
				},
			},
		}))
	}

	function updateRates(
		mutator: (rates: VehicleRatePayload[]) => VehicleRatePayload[],
	) {
		setFormValues((previous) => ({
			...previous,
			rates: {
				rates: ensureMonthlyPrimaryRate(mutator(previous.rates.rates)),
			},
		}))
	}

	function updateRateAtIndex(
		rateIndex: number,
		nextValues: Partial<VehicleRatePayload>,
	) {
		updateRates((rates) =>
			rates.map((rate, index) =>
				index === rateIndex ? { ...rate, ...nextValues } : rate,
			),
		)
	}

	function onRateModelChange(rateIndex: number, pricingModel: PricingModel) {
		const duplicateIndex = rateEntries.findIndex(
			(rate, index) =>
				index !== rateIndex && rate.pricingModel === pricingModel,
		)

		if (duplicateIndex !== -1) {
			setFormError(
				`Only one ${pricingModel.toLowerCase()} pricing rate is allowed.`,
			)
			return
		}

		setFormError(null)
		updateRateAtIndex(rateIndex, { pricingModel })
	}

	function onAddRate() {
		const nextModel = availablePricingModels[0]

		if (!nextModel) {
			setFormError("You already configured every available pricing model.")
			return
		}

		setFormError(null)
		updateRates((rates) => [...rates, createDefaultRate(nextModel)])
	}

	function onRemoveRate(rateIndex: number) {
		const targetRate = rateEntries[rateIndex]
		if (!targetRate) {
			return
		}

		if (targetRate.pricingModel === "Monthly") {
			setFormError("Monthly rental rate is required and cannot be removed.")
			return
		}

		setFormError(null)
		updateRates((rates) => rates.filter((_, index) => index !== rateIndex))
	}

	function validateCurrentStep(step: number): string | null {
		if (step === 0) {
			const identityParsed = vehicleIdentitySchema.safeParse(
				formValues.identity,
			)
			if (!identityParsed.success) {
				return (
					identityParsed.error.issues[0]?.message ??
					"Complete vehicle identity fields."
				)
			}

			return null
		}

		if (step >= 1 && step <= 3) {
			if (uploadImagesMutation.isPending) {
				return "Wait for image uploads to finish before continuing."
			}

			const activeGroup = imageStepOrder[step - 1]
			if (!activeGroup) {
				return "Unable to identify image upload step."
			}

			const activeGroupLabel = imageGroupLabels[activeGroup].title.toLowerCase()
			if ((formValues.images[activeGroup] ?? []).length === 0) {
				return `Upload at least one ${activeGroupLabel} entry before continuing.`
			}

			if (step === 3) {
				for (const group of imageStepOrder) {
					if ((formValues.images[group] ?? []).length === 0) {
						return `Upload at least one ${imageGroupLabels[group].title.toLowerCase()} entry before continuing.`
					}
				}
			}

			return null
		}

		if (step === 4) {
			const specsParsed = vehicleSpecsSchema.safeParse(formValues.specs)
			if (!specsParsed.success) {
				return (
					specsParsed.error.issues[0]?.message ??
					"Complete vehicle specifications."
				)
			}

			return null
		}

		if (step === 5) {
			const operationsParsed = vehicleOperationsSchema.safeParse(
				formValues.operations,
			)
			if (!operationsParsed.success) {
				return (
					operationsParsed.error.issues[0]?.message ??
					"Complete operations and compliance details."
				)
			}

			return null
		}

		const ratesParsed = vehicleRatesSchema.safeParse(formValues.rates)
		if (!ratesParsed.success) {
			return ratesParsed.error.issues[0]?.message ?? "Complete pricing details."
		}

		return null
	}

	function openCreateDrawer() {
		setDrawerMode("create")
		setDrawerStep(0)
		setCreateDraftId(crypto.randomUUID())
		setUploadProgressByFile({})
		setUploadingGroup(null)
		setFormError(null)
		setFormValues(defaultVehicleFormValues)
		setIsDrawerOpen(true)
	}

	function openRentalDrawer(vehicleId?: string) {
		if (!canCreateRentals) {
			setFormError("Your role does not have access to rental workflows.")
			return
		}

		setRentalPreselectedVehicleId(vehicleId ?? null)
		setIsRentalDrawerOpen(true)
	}

	function removeImageFromGroup(group: VehicleImageGroupKey, assetId: string) {
		setFormValues((previous) => {
			const currentAssets = previous.images[group] ?? []
			const filtered = currentAssets
				.filter((asset) => asset.assetId !== assetId)
				.map((asset, index) => ({ ...asset, sortOrder: index }))

			return {
				...previous,
				images: {
					...previous.images,
					[group]: filtered,
				},
			}
		})
	}

	async function uploadImageGroup(group: VehicleImageGroupKey, files: File[]) {
		if (!activeOrganizationId) {
			setFormError("Select an active organization first.")
			return
		}

		if (!uploadEntityId) {
			setFormError("Unable to prepare upload target for this vehicle.")
			return
		}

		const groupConfig = imageGroupLabels[group]

		setFormError(null)
		setUploadingGroup(group)
		setUploadProgressByFile({})

		try {
			const uploaded = await uploadImagesMutation.mutateAsync({
				organizationId: activeOrganizationId,
				files,
				entityType: uploadEntityType,
				entityId: uploadEntityId,
				field: groupConfig.field,
				metadata: {
					source: "vehicle-catalog",
					group: groupConfig.field,
				},
				onFileProgress: (fileName, percentage) => {
					setUploadProgressByFile((previous) => ({
						...previous,
						[fileName]: percentage,
					}))
				},
			})

			const uploadedAssets = uploaded.map((item) => {
				if (!item.blurDataUrl) {
					throw new Error("Uploaded image is missing blur placeholder data.")
				}

				return {
					assetId: item.assetId,
					url: item.url,
					deliveryUrl: item.deliveryUrl,
					blurDataUrl: item.blurDataUrl,
				}
			})

			setFormValues((previous) => {
				const currentAssets = previous.images[group] ?? []
				const nextAssets: VehicleImageAsset[] = [
					...currentAssets,
					...uploadedAssets.map((asset, index) => ({
						...asset,
						sortOrder: currentAssets.length + index,
					})),
				].map((asset, index) => ({ ...asset, sortOrder: index }))

				return {
					...previous,
					images: {
						...previous.images,
						[group]: nextAssets,
					},
				}
			})

			toast.success(
				`${uploaded.length} image(s) uploaded to ${groupConfig.title}.`,
			)
		} catch (error) {
			const message = resolveErrorMessage(error, "Unable to upload images.")
			setFormError(message)
			toast.error(message)
		} finally {
			setUploadingGroup(null)
			setUploadProgressByFile({})
		}
	}

	function onBrandChange(brandId: string) {
		updateIdentity({ brandId })

		const models = metaQuery.data?.models ?? []
		const matchingModel = models.find(
			(model) =>
				model.id === formValues.identity.modelId && model.brandId === brandId,
		)

		if (!matchingModel) {
			updateIdentity({ modelId: "" })
		}
	}

	function onNextStep() {
		const stepError = validateCurrentStep(drawerStep)
		if (stepError) {
			setFormError(stepError)
			return
		}

		setFormError(null)
		setDrawerStep((previous) =>
			Math.min(previous + 1, drawerStepConfig.length - 1),
		)
	}

	function onPreviousStep() {
		setFormError(null)
		setDrawerStep((previous) => Math.max(previous - 1, 0))
	}

	async function onSubmitVehicle() {
		const parsed = vehicleSchema.safeParse(formValues)

		if (!parsed.success) {
			setFormError(
				parsed.error.issues[0]?.message ?? "Invalid vehicle payload.",
			)
			return
		}

		setFormError(null)

		try {
			if (drawerMode === "create") {
				const created = (await createVehicleMutation.mutateAsync(
					parsed.data,
				)) as {
					id?: string
				}

				if (created?.id) {
					setSelectedVehicleId(created.id)
				}
			} else if (selectedVehicleId) {
				await updateVehicleMutation.mutateAsync({
					vehicleId: selectedVehicleId,
					payload: parsed.data,
				})
			}

			setIsDrawerOpen(false)
		} catch (error) {
			const message = resolveErrorMessage(
				error,
				"Unable to save vehicle details.",
			)
			setFormError(message)
			toast.error(message)
		}
	}

	async function onConfirmDelete() {
		if (!deleteTarget) {
			return
		}

		try {
			await deleteVehicleMutation.mutateAsync(deleteTarget.id)

			if (selectedVehicleId === deleteTarget.id) {
				setSelectedVehicleId(null)
			}
		} catch (error) {
			const message = resolveErrorMessage(error, "Unable to delete vehicle.")
			setFormError(message)
			toast.error(message)
		} finally {
			setDeleteTarget(null)
		}
	}

	async function onConfirmStatusChange() {
		if (!statusTarget) {
			return
		}

		try {
			await updateVehicleStatusMutation.mutateAsync({
				vehicleId: statusTarget.id,
				status: statusTarget.status,
			})
		} catch (error) {
			const message = resolveErrorMessage(
				error,
				"Unable to update vehicle status.",
			)
			setFormError(message)
			toast.error(message)
		} finally {
			setStatusTarget(null)
		}
	}

	if (!activeOrganizationId) {
		return (
			<section className="space-y-3">
				<PageSectionHeader title="Vehicle Catalog" />
				<p className="text-muted-foreground text-sm">
					Select an active organization first.
				</p>
			</section>
		)
	}

	const isLoadingList = catalogQuery.isPending || metaQuery.isPending
	const totalDrawerSteps = drawerStepConfig.length
	const activeDrawerStep = drawerStepConfig[drawerStep] ?? drawerStepConfig[0]
	const activeImageGroup =
		drawerStep >= 1 && drawerStep <= 3 ? imageStepOrder[drawerStep - 1] : null
	const imagePreviewGroups: Array<{
		key: VehicleImageGroupKey
		title: string
		assets: VehicleImageAsset[]
	}> = [
		{
			key: "frontImages",
			title: imageGroupLabels.frontImages.title,
			assets: formValues.images.frontImages,
		},
		{
			key: "backImages",
			title: imageGroupLabels.backImages.title,
			assets: formValues.images.backImages,
		},
		{
			key: "interiorImages",
			title: imageGroupLabels.interiorImages.title,
			assets: formValues.images.interiorImages,
		},
	]
	const uploadedImageCount = imagePreviewGroups.reduce(
		(total, group) => total + group.assets.length,
		0,
	)

	function handleDrawerOpenChange(open: boolean) {
		setIsDrawerOpen(open)
		if (!open) {
			setFormError(null)
			setDrawerStep(0)
			setUploadingGroup(null)
			setUploadProgressByFile({})
		}
	}

	return (
		<section className="space-y-8">
			<PageSectionHeader
				title="Vehicle Catalog"
				actions={
					canManageVehicles ? (
						<Button
							type="button"
							size="lg"
							className="h-12"
							onClick={openCreateDrawer}
						>
							<Plus />
							Add vehicle
						</Button>
					) : null
				}
			/>

			{formError ? (
				<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{formError}
				</p>
			) : null}

			{isLoadingList ? (
				<section className="rounded-2xl border px-4 py-8 text-sm text-muted-foreground">
					Loading vehicle catalog...
				</section>
			) : vehicles.length === 0 ? (
				<section className="rounded-2xl border px-4 py-8 text-sm text-muted-foreground">
					No vehicles yet. Add your first vehicle to get started.
				</section>
			) : (
				<VehicleCatalogTable
					vehicles={vehicles}
					canManageVehicles={canManageVehicles}
					canCreateRentals={canCreateRentals}
					onOpenVehicle={(vehicleId) => {
						router.push(routes.app.vehicleDetails(vehicleId))
					}}
					onToggleMaintenance={(vehicle) => {
						setStatusTarget({
							id: vehicle.id,
							label: `${vehicle.year} ${vehicle.brandName} ${vehicle.modelName}`,
							status:
								vehicle.status === "Maintenance" ? "Available" : "Maintenance",
						})
					}}
					onDeleteVehicle={(vehicle) => {
						setDeleteTarget({
							id: vehicle.id,
							label: `${vehicle.year} ${vehicle.brandName} ${vehicle.modelName}`,
						})
					}}
					onRentVehicle={(vehicle) => {
						openRentalDrawer(vehicle.id)
					}}
				/>
			)}

			<RentalAppointmentDrawer
				open={isRentalDrawerOpen}
				onOpenChange={setIsRentalDrawerOpen}
				preselectedVehicleId={rentalPreselectedVehicleId}
				onRentalFinalized={() => {
					void catalogQuery.refetch()
				}}
			/>

			{drawerMode === "create" ? (
				<VehicleCreateWizardDrawer
					open={isDrawerOpen}
					onOpenChange={handleDrawerOpenChange}
					formError={formError}
					drawerStep={drawerStep}
					steps={drawerStepConfig}
					formValues={formValues}
					selectedColor={selectedColor}
					colorPresets={colorPresets}
					brandOptions={brandOptions}
					modelOptions={modelOptions}
					vehicleClassOptions={vehicleClassOptions}
					bodyTypeOptions={bodyTypeOptions}
					yearOptions={yearOptions}
					seatOptions={seatOptions}
					doorOptions={doorOptions}
					baggageOptions={baggageOptions}
					vehicleStatuses={vehicleStatuses}
					transmissions={transmissions}
					fuelTypes={fuelTypes}
					drivetrains={drivetrains}
					pricingModels={pricingModels}
					rateEntries={rateEntries}
					availablePricingModels={availablePricingModels}
					activeImageGroup={activeImageGroup}
					imageGroupLabels={imageGroupLabels}
					imagePreviewGroups={imagePreviewGroups}
					uploadedImageCount={uploadedImageCount}
					uploadingGroup={uploadingGroup}
					uploadProgressByFile={uploadProgressByFile}
					createVehiclePending={createVehicleMutation.isPending}
					uploadImagesPending={uploadImagesMutation.isPending}
					onPreviousStep={onPreviousStep}
					onNextStep={onNextStep}
					onSubmitVehicle={() => {
						void onSubmitVehicle()
					}}
					onBrandChange={onBrandChange}
					updateIdentity={updateIdentity}
					updateSpecs={updateSpecs}
					updateOperations={updateOperations}
					onFeatureChange={onFeatureChange}
					onUploadImageGroup={(group, files) => {
						void uploadImageGroup(group, files)
					}}
					onRemoveImage={removeImageFromGroup}
					updateRateAtIndex={updateRateAtIndex}
					onRateModelChange={onRateModelChange}
					onAddRate={onAddRate}
					onRemoveRate={onRemoveRate}
				/>
			) : (
				<Drawer open={isDrawerOpen} onOpenChange={handleDrawerOpenChange}>
					<DrawerContent className="h-dvh rounded-none!">
						<DrawerHeader className="border-b px-4 pb-3">
							<div className="drawer-container">
								<DrawerTitle>Edit vehicle</DrawerTitle>
								<DrawerDescription>
									Step {drawerStep + 1} of {totalDrawerSteps} •{" "}
									{activeDrawerStep.title}. {activeDrawerStep.description}
								</DrawerDescription>
							</div>
						</DrawerHeader>

						<div className="overflow-y-auto px-4 py-4">
							<div className="drawer-container">
								<div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
									<aside className="space-y-4 lg:pr-2">
										<div className="space-y-1">
											<p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
												Vehicle setup flow
											</p>
											<p className="text-sm font-medium">
												{activeDrawerStep.title}
											</p>
											<p className="text-muted-foreground text-sm leading-relaxed">
												{activeDrawerStep.description}
											</p>
										</div>

										<div className="bg-muted h-1.5 overflow-hidden rounded-full">
											<div
												className="bg-primary h-full rounded-full transition-all"
												style={{
													width: `${Math.round(((drawerStep + 1) / totalDrawerSteps) * 100)}%`,
												}}
											/>
										</div>

										<ol className="space-y-1">
											{drawerStepConfig.map((step, index) => {
												const isCompleted = index < drawerStep
												const isActive = index === drawerStep
												const isLocked = index > drawerStep

												return (
													<li key={step.title}>
														<button
															type="button"
															onClick={() => {
																if (!isLocked) {
																	setFormError(null)
																	setDrawerStep(index)
																}
															}}
															disabled={isLocked}
															className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
																isActive
																	? "border-primary/40 bg-primary/5"
																	: "hover:bg-muted/60"
															}`}
														>
															<span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full border text-xs font-medium">
																{isCompleted ? (
																	<CheckCircle2 className="text-primary size-4" />
																) : (
																	index + 1
																)}
															</span>
															<span className="space-y-0.5">
																<p className="text-sm font-medium">
																	{step.title}
																</p>
																<p className="text-muted-foreground text-xs">
																	{step.description}
																</p>
															</span>
														</button>
													</li>
												)
											})}
										</ol>

										{drawerStep >= 1 && drawerStep <= 3 ? (
											<div className="border-t pt-3">
												<p className="text-muted-foreground text-xs leading-relaxed">
													Each uploaded image gets a generated blur preview
													before you move to the next stage.
												</p>
											</div>
										) : null}
									</aside>

									<div className="space-y-6 pb-2">
										{drawerStep === 0 ? (
											<FieldGroup className="gap-5">
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
															value={
																formValues.identity.vehicleClassId ?? "none"
															}
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
																	bodyTypeId:
																		value === "none" ? undefined : value,
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
																	licensePlate:
																		event.target.value.toUpperCase(),
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

												<Field
													orientation="horizontal"
													className="items-center justify-between rounded-md border px-3 py-2"
												>
													<FieldLabel htmlFor="is-brand-new">
														Brand new vehicle
													</FieldLabel>
													<Switch
														id="is-brand-new"
														checked={formValues.identity.isBrandNew}
														onCheckedChange={(checked) =>
															updateIdentity({ isBrandNew: checked })
														}
													/>
												</Field>
											</FieldGroup>
										) : null}

										{drawerStep >= 1 && drawerStep <= 3 && activeImageGroup ? (
											<FieldGroup className="gap-6">
												<div className="space-y-1">
													<p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
														Image capture
													</p>
													<p className="text-lg font-semibold">
														{imageGroupLabels[activeImageGroup].title}
													</p>
													<p className="text-muted-foreground text-sm leading-relaxed">
														{imageGroupLabels[activeImageGroup].description}
													</p>
												</div>

												<VehicleImageGroupUpload
													title={imageGroupLabels[activeImageGroup].title}
													description={
														imageGroupLabels[activeImageGroup].description
													}
													assets={formValues.images[activeImageGroup]}
													isUploading={
														uploadImagesMutation.isPending &&
														uploadingGroup === activeImageGroup
													}
													uploadProgressByFile={
														uploadingGroup === activeImageGroup
															? uploadProgressByFile
															: {}
													}
													onFilesSelected={(files) => {
														void uploadImageGroup(activeImageGroup, files)
													}}
													onRemove={(assetId) =>
														removeImageFromGroup(activeImageGroup, assetId)
													}
												/>

												<div className="space-y-4 border-t pt-5">
													<div className="flex items-center justify-between gap-2">
														<p className="text-sm font-medium">
															All image previews
														</p>
														<Badge variant="outline">
															{uploadedImageCount} total
														</Badge>
													</div>

													<div className="grid gap-4 md:grid-cols-3">
														{imagePreviewGroups.map((group) => (
															<div key={group.key} className="space-y-2">
																<p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
																	{group.title} ({group.assets.length})
																</p>

																{group.assets.length === 0 ? (
																	<p className="text-muted-foreground text-xs">
																		No images yet.
																	</p>
																) : (
																	<div className="grid grid-cols-2 gap-2">
																		{group.assets.map((asset) => (
																			<div
																				key={`${group.key}-${asset.assetId}`}
																				className="bg-muted/40 relative aspect-[4/3] overflow-hidden rounded-md border"
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
																					sizes="(min-width: 1024px) 18vw, 40vw"
																					className="relative h-full w-full object-cover"
																				/>
																			</div>
																		))}
																	</div>
																)}
															</div>
														))}
													</div>
												</div>
											</FieldGroup>
										) : null}

										{drawerStep === 4 ? (
											<FieldGroup className="gap-5">
												<Field>
													<FieldLabel>Transmission</FieldLabel>
													<ToggleGroup
														type="single"
														value={formValues.specs.transmission}
														onValueChange={(value) => {
															if (!value) {
																return
															}

															updateSpecs({
																transmission: value as Transmission,
															})
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

												<div className="grid gap-3 md:grid-cols-2">
													{[
														{
															id: "feature-ac",
															label: "Air conditioning",
															key: "hasAC" as const,
														},
														{
															id: "feature-nav",
															label: "Navigation",
															key: "hasNavigation" as const,
														},
														{
															id: "feature-bluetooth",
															label: "Bluetooth",
															key: "hasBluetooth" as const,
														},
														{
															id: "feature-pet",
															label: "Pet friendly",
															key: "isPetFriendly" as const,
														},
													].map((feature) => (
														<Field
															key={feature.id}
															orientation="horizontal"
															className="items-center justify-between rounded-md border px-3 py-2"
														>
															<FieldLabel htmlFor={feature.id}>
																{feature.label}
															</FieldLabel>
															<Switch
																id={feature.id}
																checked={formValues.specs.features[feature.key]}
																onCheckedChange={(checked) =>
																	onFeatureChange(feature.key, checked)
																}
															/>
														</Field>
													))}
												</div>
											</FieldGroup>
										) : null}

										{drawerStep === 5 ? (
											<FieldGroup className="gap-5">
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

												<div className="grid gap-5 md:grid-cols-2">
													<Field>
														<FieldLabel htmlFor="registration-expiry">
															Registration expiry
														</FieldLabel>
														<Input
															id="registration-expiry"
															type="date"
															value={
																formValues.operations.registrationExpiryDate
															}
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
											</FieldGroup>
										) : null}

										{drawerStep === 6 ? (
											<FieldGroup className="gap-6">
												<div className="space-y-1">
													<p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
														Rate configuration
													</p>
													<p className="text-lg font-semibold">
														Pricing models
													</p>
													<p className="text-muted-foreground text-sm leading-relaxed">
														Monthly rental is the required primary model. Add
														optional daily, weekly, and distance-based rates as
														needed.
													</p>
												</div>

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

													const isMonthlyPrimary =
														rate.pricingModel === "Monthly"

													function isUsedByAnotherRate(
														pricingModel: PricingModel,
													) {
														return rateEntries.some(
															(entry, entryIndex) =>
																entryIndex !== rateIndex &&
																entry.pricingModel === pricingModel,
														)
													}

													return (
														<div
															key={`${rate.pricingModel}-${rateIndex}`}
															className="grid gap-5 border-y py-5 lg:grid-cols-[220px_minmax(0,1fr)]"
														>
															<div className="space-y-3">
																<div className="space-y-1">
																	<p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
																		{isMonthlyPrimary
																			? "Primary model"
																			: "Optional model"}
																	</p>
																	<p className="text-sm font-medium">
																		{rate.pricingModel} rental
																	</p>
																	<p className="text-muted-foreground text-sm leading-relaxed">
																		Set price, mileage policy, and security
																		deposit.
																	</p>
																</div>

																<div className="flex flex-wrap gap-2">
																	{isMonthlyPrimary ? (
																		<Badge variant="secondary">Required</Badge>
																	) : (
																		<Badge variant="outline">Optional</Badge>
																	)}
																	<Badge variant="outline">
																		{rate.mileagePolicy.mileageType}
																	</Badge>
																</div>

																<Button
																	type="button"
																	variant="outline"
																	onClick={() => onRemoveRate(rateIndex)}
																	disabled={isMonthlyPrimary}
																	className="h-9 w-full justify-start"
																>
																	<Trash2 />
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
																				disabled={isUsedByAnotherRate(
																					pricingModel,
																				)}
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
																						rate: Number(
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

																	<Field
																		orientation="horizontal"
																		className="items-center justify-between rounded-md border px-3 py-2"
																	>
																		<div className="space-y-0.5">
																			<FieldLabel
																				htmlFor={`limited-mileage-${rateIndex}`}
																			>
																				Limited mileage
																			</FieldLabel>
																			<p className="text-muted-foreground text-xs">
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

																{rate.mileagePolicy.mileageType ===
																"Limited" ? (
																	<div className="grid gap-4 rounded-md border p-3 md:grid-cols-3">
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
																			<p className="text-muted-foreground text-xs">
																				Maximum distance allowed per day.
																			</p>
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
																			<p className="text-muted-foreground text-xs">
																				Fee charged for each extra
																				kilometer/mile.
																			</p>
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
																							measureUnit:
																								value as DistanceUnit,
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

																<Field
																	orientation="horizontal"
																	className="items-center justify-between rounded-md border px-3 py-2"
																>
																	<div className="space-y-0.5">
																		<FieldLabel
																			htmlFor={`requires-deposit-${rateIndex}`}
																		>
																			Security deposit
																		</FieldLabel>
																		<p className="text-muted-foreground text-xs">
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

												<div className="space-y-2 border-t pt-5 text-center">
													<p className="text-sm font-medium">Add rates</p>
													<p className="text-muted-foreground text-sm">
														Configure pricing, mileage policy, and security
														deposit for this vehicle.
													</p>
													<Button
														type="button"
														variant="outline"
														className="mx-auto h-11"
														onClick={onAddRate}
														disabled={availablePricingModels.length === 0}
													>
														<Plus />
														Add rate
													</Button>
													{availablePricingModels.length === 0 ? (
														<p className="text-muted-foreground text-xs">
															All pricing models are already configured.
														</p>
													) : (
														<p className="text-muted-foreground text-xs">
															Available: {availablePricingModels.join(" • ")}
														</p>
													)}
												</div>
											</FieldGroup>
										) : null}
									</div>
								</div>
							</div>
						</div>

						<DrawerFooter className="border-t px-4 pb-4">
							<div className="drawer-container">
								{formError ? (
									<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
										{formError}
									</p>
								) : null}

								<div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
									<Button
										type="button"
										variant="outline"
										className="h-11"
										onClick={onPreviousStep}
										disabled={drawerStep === 0}
									>
										Back
									</Button>

									{drawerStep < totalDrawerSteps - 1 ? (
										<Button
											type="button"
											className="h-11"
											onClick={onNextStep}
											disabled={uploadImagesMutation.isPending}
										>
											{uploadImagesMutation.isPending &&
											drawerStep >= 1 &&
											drawerStep <= 3
												? "Uploading..."
												: "Continue"}
										</Button>
									) : (
										<Button
											type="button"
											className="h-11"
											onClick={() => {
												void onSubmitVehicle()
											}}
											disabled={
												updateVehicleMutation.isPending ||
												uploadImagesMutation.isPending
											}
										>
											{updateVehicleMutation.isPending
												? "Saving..."
												: "Save changes"}
										</Button>
									)}
								</div>
							</div>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
			)}

			<AlertDialog
				open={Boolean(deleteTarget)}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete vehicle</AlertDialogTitle>
						<AlertDialogDescription>
							Confirm deletion for {deleteTarget?.label}. This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteVehicleMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={onConfirmDelete}
							disabled={deleteVehicleMutation.isPending}
						>
							{deleteVehicleMutation.isPending ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={Boolean(statusTarget)}
				onOpenChange={(open) => !open && setStatusTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Confirm status update</AlertDialogTitle>
						<AlertDialogDescription>
							Set {statusTarget?.label} to {statusTarget?.status}?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={updateVehicleStatusMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={onConfirmStatusChange}
							disabled={updateVehicleStatusMutation.isPending}
						>
							{updateVehicleStatusMutation.isPending
								? "Updating..."
								: "Confirm"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	)
}
