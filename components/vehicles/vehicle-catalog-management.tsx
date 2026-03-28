"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useMemo, useState } from "react"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import { VehicleCatalogTable } from "@/components/vehicles/vehicle-catalog-table"
import { VehicleCreateWizardDrawer } from "@/components/vehicles/vehicle-create-wizard-drawer"
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

		openEditDrawer(detailsQuery.data)
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

	const openEditDrawer = useEffectEvent((details: VehicleDetails) => {
		setDrawerMode("edit")
		setCreateDraftId(null)
		resetDrawerState()
		setFormValues(mapVehicleToFormValues(details))
		setIsDrawerOpen(true)
	})

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

	function updateFormSection<Key extends keyof VehicleFormValues>(
		key: Key,
		nextValues: Partial<VehicleFormValues[Key]>,
	) {
		setFormValues((previous) => ({
			...previous,
			[key]: {
				...previous[key],
				...nextValues,
			},
		}))
	}

	function updateIdentity(nextValues: Partial<VehicleFormValues["identity"]>) {
		updateFormSection("identity", nextValues)
	}

	function updateSpecs(nextValues: Partial<VehicleFormValues["specs"]>) {
		updateFormSection("specs", nextValues)
	}

	function updateOperations(
		nextValues: Partial<VehicleFormValues["operations"]>,
	) {
		updateFormSection("operations", nextValues)
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

	function resetDrawerState() {
		setDrawerStep(0)
		setUploadProgressByFile({})
		setUploadingGroup(null)
		setFormError(null)
	}

	function openCreateDrawer() {
		setDrawerMode("create")
		setCreateDraftId(crypto.randomUUID())
		resetDrawerState()
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
	const activeImageGroup =
		drawerStep >= 1 && drawerStep <= 3 ? imageStepOrder[drawerStep - 1] : null
	const imagePreviewGroups: Array<{
		key: VehicleImageGroupKey
		title: string
		assets: VehicleImageAsset[]
	}> = imageStepOrder.map((groupKey) => ({
		key: groupKey,
		title: imageGroupLabels[groupKey].title,
		assets: formValues.images[groupKey],
	}))
	const uploadedImageCount = imagePreviewGroups.reduce(
		(total, group) => total + group.assets.length,
		0,
	)
	const isCreateMode = drawerMode === "create"
	const drawerTitle = isCreateMode ? "Add vehicle to catalog" : "Edit vehicle"
	const drawerDescription = isCreateMode
		? "Add the vehicle details, photos, specifications, operations, and pricing in one guided flow."
		: "Update the vehicle details, photos, specifications, operations, and pricing in one guided flow."
	const submitPending = isCreateMode
		? createVehicleMutation.isPending
		: updateVehicleMutation.isPending
	const submitLabel = isCreateMode ? "Create vehicle" : "Save changes"
	const submitPendingLabel = "Saving..."

	function handleDrawerOpenChange(open: boolean) {
		setIsDrawerOpen(open)
		if (!open) {
			resetDrawerState()
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

			<VehicleCreateWizardDrawer
				open={isDrawerOpen}
				onOpenChange={handleDrawerOpenChange}
				title={drawerTitle}
				description={drawerDescription}
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
				submitPending={submitPending}
				submitLabel={submitLabel}
				submitPendingLabel={submitPendingLabel}
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
