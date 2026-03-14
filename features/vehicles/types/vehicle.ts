export type Transmission = "Automatic" | "Manual" | "Semi-Automatic"
export type FuelType = "Petrol" | "Diesel" | "Electric" | "Hybrid" | "Hydrogen"
export type Drivetrain =
	| "FWD"
	| "RWD"
	| "AWD"
	| "4WD"
	| "Electric-Single"
	| "Electric-Dual"
export type VehicleStatus = "Available" | "Rented" | "Maintenance" | "Retired"
export type PricingModel = "Daily" | "Weekly" | "Monthly" | "Distance-Based"
export type MileageType = "Unlimited" | "Limited"
export type DistanceUnit = "km" | "miles"

export type VehicleColor = {
	name: string
	label: string
	hex: string
}

export type VehicleIdentityPayload = {
	brandId: string
	modelId: string
	vehicleClassId?: string
	bodyTypeId?: string
	year: number
	vin: string
	licensePlate: string
	color: VehicleColor
	isBrandNew: boolean
}

export type VehicleSpecsPayload = {
	transmission: Transmission
	fuelType: FuelType
	drivetrain: Drivetrain
	seats: number
	doors: number
	baggageCapacity: number
	features: {
		hasAC: boolean
		hasNavigation: boolean
		hasBluetooth: boolean
		isPetFriendly: boolean
	}
}

export type VehicleOperationsPayload = {
	status: VehicleStatus
	registrationExpiryDate: string
	insuranceExpiryDate: string
	insurancePolicyNumber: string
}

export type VehicleImageAsset = {
	assetId: string
	url: string
	deliveryUrl: string
	blurDataUrl: string
	sortOrder: number
}

export type VehicleImagePayload = {
	frontImages: VehicleImageAsset[]
	backImages: VehicleImageAsset[]
	interiorImages: VehicleImageAsset[]
}

export type VehicleRatePayload = {
	pricingModel: PricingModel
	rate: number
	mileagePolicy:
		| { mileageType: "Unlimited" }
		| {
				mileageType: "Limited"
				limitPerDay: number
				overageFeePerUnit: number
				measureUnit: DistanceUnit
		  }
	requiresDeposit: boolean
	depositAmount?: number
}

export type VehicleCreatePayload = {
	identity: VehicleIdentityPayload
	images: VehicleImagePayload
	specs: VehicleSpecsPayload
	operations: VehicleOperationsPayload
	rates: {
		rates: VehicleRatePayload[]
	}
}

export type VehicleSummary = {
	id: string
	branchId: string | null
	vehicleClassId: string | null
	vehicleClassName: string | null
	vehicleClassCode: string | null
	brandName: string
	modelName: string
	year: number
	licensePlate: string
	status: VehicleStatus
	fuelType: FuelType
	transmission: Transmission
	seats: number
	bodyTypeId: string | null
	frontImage: {
		assetId: string
		url: string
		deliveryUrl: string
		blurDataUrl: string
	} | null
	primaryRate: {
		pricingModel: PricingModel
		rate: number
		requiresDeposit: boolean
		depositAmount: number | null
	} | null
	rates: Array<{
		pricingModel: PricingModel
		rate: number
		requiresDeposit: boolean
		depositAmount: number | null
	}>
	createdAt: string
}

export type VehicleDetails = {
	id: string
	organizationId: string
	branchId: string | null
	vehicleClassId: string | null
	vehicleClassName: string | null
	vehicleClassCode: string | null
	brandId: string
	brandName: string
	modelId: string
	modelName: string
	bodyTypeId: string | null
	bodyTypeName: string | null
	year: number
	vin: string
	licensePlate: string
	color: VehicleColor
	isBrandNew: boolean
	transmission: Transmission
	fuelType: FuelType
	drivetrain: Drivetrain
	seats: number
	doors: number
	baggageCapacity: number
	hasAc: boolean
	hasNavigation: boolean
	hasBluetooth: boolean
	isPetFriendly: boolean
	status: VehicleStatus
	registrationExpiryDate: string
	insuranceExpiryDate: string
	insurancePolicyNumber: string
	images: VehicleImagePayload
	rates: Array<{
		id: string
		pricingModel: PricingModel
		rate: number
		mileageType: MileageType
		limitPerDay: number | null
		overageFeePerUnit: number | null
		measureUnit: DistanceUnit | null
		requiresDeposit: boolean
		depositAmount: number | null
	}>
	createdAt: string
	updatedAt: string
}

export type VehicleCatalogResponse = {
	vehicles: VehicleSummary[]
	canManageVehicles: boolean
}

export type VehicleMetaResponse = {
	vehicleClasses: Array<{
		id: string
		name: string
		code: string
		description: string | null
		bodyTypeId: string | null
	}>
	brands: Array<{ id: string; name: string; country: string | null }>
	models: Array<{
		id: string
		brandId: string
		name: string
		bodyTypeId: string | null
	}>
	bodyTypes: Array<{ id: string; name: string }>
	canManageVehicles: boolean
}
