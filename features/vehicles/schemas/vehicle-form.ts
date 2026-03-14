import { z } from "zod"

export const TransmissionEnum = z.enum([
	"Automatic",
	"Manual",
	"Semi-Automatic",
])
export const FuelTypeEnum = z.enum([
	"Petrol",
	"Diesel",
	"Electric",
	"Hybrid",
	"Hydrogen",
])
export const DrivetrainEnum = z.enum([
	"FWD",
	"RWD",
	"AWD",
	"4WD",
	"Electric-Single",
	"Electric-Dual",
])
export const VehicleStatusEnum = z.enum([
	"Available",
	"Rented",
	"Maintenance",
	"Retired",
])
export const PricingModelEnum = z.enum([
	"Daily",
	"Weekly",
	"Monthly",
	"Distance-Based",
])

export const vehicleIdentitySchema = z.object({
	brandId: z.string().uuid("Please select a valid brand"),
	modelId: z.string().uuid("Please select a valid model"),
	vehicleClassId: z
		.string()
		.uuid("Please select a valid vehicle class")
		.optional(),
	bodyTypeId: z.string().uuid("Please select a valid body type").optional(),
	year: z
		.number({ message: "Year must be a valid number" })
		.min(1900, "Year must be 1900 or later")
		.max(new Date().getFullYear() + 1, "Year cannot be in the future"),
	vin: z
		.string()
		.trim()
		.min(5, "VIN is required")
		.max(17, "VIN must be exactly 17 characters or a short valid identifier"),
	licensePlate: z
		.string()
		.trim()
		.min(2, "License plate is required")
		.toUpperCase(),
	color: z.object({
		name: z.string().min(2, "Color name is required"),
		label: z.string().min(2, "Color label is required"),
		hex: z
			.string()
			.regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/, "Invalid hex color code"),
	}),
	isBrandNew: z.boolean().default(false),
})

const vehicleFeaturesSchema = z.object({
	hasAC: z.boolean().default(false),
	hasNavigation: z.boolean().default(false),
	hasBluetooth: z.boolean().default(false),
	isPetFriendly: z.boolean().default(false),
})

function isValidDateInputString(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (!match) {
		return false
	}

	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])

	const date = new Date(Date.UTC(year, month - 1, day))

	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	)
}

const dateInputSchema = z
	.string()
	.trim()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
	.refine(isValidDateInputString, "Date must be valid")

export const vehicleSpecsSchema = z.object({
	transmission: TransmissionEnum,
	fuelType: FuelTypeEnum,
	drivetrain: DrivetrainEnum,
	seats: z.number().min(1).max(60),
	doors: z.number().min(2).max(6),
	baggageCapacity: z.number().min(0, "Cannot be negative"),
	features: vehicleFeaturesSchema,
})

export const vehicleOperationsSchema = z.object({
	status: VehicleStatusEnum.default("Available"),
	registrationExpiryDate: dateInputSchema,
	insuranceExpiryDate: dateInputSchema,
	insurancePolicyNumber: z.string().trim().min(1, "Policy number is required"),
})

const unlimitedMileageSchema = z.object({
	mileageType: z.literal("Unlimited"),
})

const limitedMileageSchema = z.object({
	mileageType: z.literal("Limited"),
	limitPerDay: z.number().min(1, "Daily limit must be positive (e.g., 200km)"),
	overageFeePerUnit: z.number().min(0, "Cost per extra km is required"),
	measureUnit: z.enum(["km", "miles"]).default("km"),
})

function isAbsoluteHttpUrl(value: string) {
	try {
		const parsed = new URL(value)
		return parsed.protocol === "http:" || parsed.protocol === "https:"
	} catch {
		return false
	}
}

const deliveryUrlSchema = z
	.string()
	.trim()
	.min(1, "Delivery URL is required")
	.refine(
		(value) => value.startsWith("/") || isAbsoluteHttpUrl(value),
		"Delivery URL must be a valid URL or absolute path",
	)

const vehicleImageAssetSchema = z.object({
	assetId: z.string().uuid("Invalid image asset id"),
	url: z.string().url("Image URL must be a valid URL"),
	deliveryUrl: deliveryUrlSchema,
	blurDataUrl: z
		.string()
		.min(1, "Blur image placeholder is required")
		.max(10_000, "Blur image placeholder is too large"),
	sortOrder: z.number().int().min(0).max(10_000),
})

export const vehicleImagesSchema = z.object({
	frontImages: z
		.array(vehicleImageAssetSchema)
		.min(1, "At least one front image is required")
		.max(10),
	backImages: z
		.array(vehicleImageAssetSchema)
		.min(1, "At least one back image is required")
		.max(10),
	interiorImages: z
		.array(vehicleImageAssetSchema)
		.min(1, "At least one interior image is required")
		.max(10),
})

const vehicleRateSchema = z
	.object({
		pricingModel: PricingModelEnum,
		rate: z.number().min(0, "Rate must be non-negative"),
		mileagePolicy: z.discriminatedUnion("mileageType", [
			unlimitedMileageSchema,
			limitedMileageSchema,
		]),
		requiresDeposit: z.boolean().default(false),
		depositAmount: z.number().min(0).optional(),
	})
	.superRefine((data, ctx) => {
		if (
			data.requiresDeposit &&
			(!data.depositAmount || data.depositAmount <= 0)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Deposit amount is required when security deposit is enabled",
				path: ["depositAmount"],
			})
		}
	})

export const vehicleRatesSchema = z.object({
	rates: z
		.array(vehicleRateSchema)
		.min(1, "At least one pricing rate is required")
		.superRefine((rates, ctx) => {
			const seenModels = new Set<string>()

			rates.forEach((rate, index) => {
				if (seenModels.has(rate.pricingModel)) {
					ctx.addIssue({
						code: "custom",
						message: `Only one ${rate.pricingModel.toLowerCase()} pricing rate is allowed.`,
						path: [index, "pricingModel"],
					})
					return
				}

				seenModels.add(rate.pricingModel)
			})

			if (!rates.some((rate) => rate.pricingModel === "Monthly")) {
				ctx.addIssue({
					code: "custom",
					message: "Monthly rental rate is required.",
					path: [0, "pricingModel"],
				})
			}
		}),
})

export const vehicleSchema = z.object({
	identity: vehicleIdentitySchema,
	images: vehicleImagesSchema,
	specs: vehicleSpecsSchema,
	operations: vehicleOperationsSchema,
	rates: vehicleRatesSchema,
})

export type VehicleFormValues = z.infer<typeof vehicleSchema>

export const defaultVehicleFormValues: VehicleFormValues = {
	identity: {
		brandId: "",
		modelId: "",
		vehicleClassId: undefined,
		bodyTypeId: undefined,
		year: new Date().getFullYear(),
		vin: "",
		licensePlate: "",
		color: {
			name: "Black",
			label: "Black",
			hex: "#000000",
		},
		isBrandNew: false,
	},
	images: {
		frontImages: [],
		backImages: [],
		interiorImages: [],
	},
	specs: {
		transmission: "Automatic",
		fuelType: "Petrol",
		drivetrain: "FWD",
		seats: 5,
		doors: 4,
		baggageCapacity: 0,
		features: {
			hasAC: false,
			hasNavigation: false,
			hasBluetooth: false,
			isPetFriendly: false,
		},
	},
	operations: {
		status: "Available",
		registrationExpiryDate: "",
		insuranceExpiryDate: "",
		insurancePolicyNumber: "",
	},
	rates: {
		rates: [
			{
				pricingModel: "Monthly",
				rate: 0,
				mileagePolicy: { mileageType: "Unlimited" },
				requiresDeposit: false,
				depositAmount: undefined,
			},
		],
	},
}
