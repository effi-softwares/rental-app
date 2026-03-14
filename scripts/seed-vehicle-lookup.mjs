import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
	throw new Error("DATABASE_URL is not set")
}

const sql = neon(databaseUrl)

const vehicleTypes = [
	"Sedan",
	"Hatchback",
	"SUV",
	"Pickup",
	"Van",
	"Wagon",
	"Coupe",
	"Convertible",
]

const brands = [
	{ name: "Toyota", country: "Japan" },
	{ name: "Nissan", country: "Japan" },
	{ name: "Honda", country: "Japan" },
	{ name: "Hyundai", country: "South Korea" },
	{ name: "Kia", country: "South Korea" },
	{ name: "Suzuki", country: "Japan" },
	{ name: "Ford", country: "United States" },
	{ name: "Mitsubishi", country: "Japan" },
	{ name: "Mazda", country: "Japan" },
	{ name: "Volkswagen", country: "Germany" },
]

const models = [
	{ brandName: "Toyota", name: "Yaris", bodyTypeName: "Hatchback" },
	{ brandName: "Toyota", name: "Corolla", bodyTypeName: "Sedan" },
	{ brandName: "Toyota", name: "Hilux", bodyTypeName: "Pickup" },
	{ brandName: "Toyota", name: "RAV4", bodyTypeName: "SUV" },

	{ brandName: "Nissan", name: "March", bodyTypeName: "Hatchback" },
	{ brandName: "Nissan", name: "Sunny", bodyTypeName: "Sedan" },
	{ brandName: "Nissan", name: "X-Trail", bodyTypeName: "SUV" },
	{ brandName: "Nissan", name: "Navara", bodyTypeName: "Pickup" },

	{ brandName: "Honda", name: "Fit", bodyTypeName: "Hatchback" },
	{ brandName: "Honda", name: "City", bodyTypeName: "Sedan" },
	{ brandName: "Honda", name: "CR-V", bodyTypeName: "SUV" },
	{ brandName: "Honda", name: "Civic", bodyTypeName: "Sedan" },

	{ brandName: "Hyundai", name: "Grand i10", bodyTypeName: "Hatchback" },
	{ brandName: "Hyundai", name: "Elantra", bodyTypeName: "Sedan" },
	{ brandName: "Hyundai", name: "Creta", bodyTypeName: "SUV" },
	{ brandName: "Hyundai", name: "Santa Fe", bodyTypeName: "SUV" },

	{ brandName: "Kia", name: "Picanto", bodyTypeName: "Hatchback" },
	{ brandName: "Kia", name: "Cerato", bodyTypeName: "Sedan" },
	{ brandName: "Kia", name: "Sportage", bodyTypeName: "SUV" },
	{ brandName: "Kia", name: "Carnival", bodyTypeName: "Van" },

	{ brandName: "Suzuki", name: "Swift", bodyTypeName: "Hatchback" },
	{ brandName: "Suzuki", name: "Ciaz", bodyTypeName: "Sedan" },
	{ brandName: "Suzuki", name: "Vitara", bodyTypeName: "SUV" },
	{ brandName: "Suzuki", name: "Jimny", bodyTypeName: "SUV" },

	{ brandName: "Ford", name: "Focus", bodyTypeName: "Hatchback" },
	{ brandName: "Ford", name: "Ranger", bodyTypeName: "Pickup" },
	{ brandName: "Ford", name: "Everest", bodyTypeName: "SUV" },
	{ brandName: "Ford", name: "Transit", bodyTypeName: "Van" },

	{ brandName: "Mitsubishi", name: "Lancer", bodyTypeName: "Sedan" },
	{ brandName: "Mitsubishi", name: "Outlander", bodyTypeName: "SUV" },
	{ brandName: "Mitsubishi", name: "L200", bodyTypeName: "Pickup" },
	{ brandName: "Mitsubishi", name: "Pajero", bodyTypeName: "SUV" },

	{ brandName: "Mazda", name: "2", bodyTypeName: "Hatchback" },
	{ brandName: "Mazda", name: "3", bodyTypeName: "Sedan" },
	{ brandName: "Mazda", name: "CX-5", bodyTypeName: "SUV" },
	{ brandName: "Mazda", name: "BT-50", bodyTypeName: "Pickup" },

	{ brandName: "Volkswagen", name: "Polo", bodyTypeName: "Hatchback" },
	{ brandName: "Volkswagen", name: "Jetta", bodyTypeName: "Sedan" },
	{ brandName: "Volkswagen", name: "Tiguan", bodyTypeName: "SUV" },
	{ brandName: "Volkswagen", name: "Transporter", bodyTypeName: "Van" },
]

async function upsertVehicleType(name) {
	const rows = await sql`
		insert into vehicle_type (name)
		values (${name})
		on conflict (name)
		do update set name = excluded.name
		returning id
	`

	return rows[0]?.id
}

async function upsertVehicleBrand(name, country) {
	const rows = await sql`
		insert into vehicle_brand (name, country)
		values (${name}, ${country})
		on conflict (name)
		do update set country = excluded.country
		returning id
	`

	return rows[0]?.id
}

async function upsertVehicleModel(brandId, name, bodyTypeId) {
	await sql`
		insert into vehicle_model (brand_id, body_type_id, name)
		values (${brandId}, ${bodyTypeId}, ${name})
		on conflict (brand_id, name)
		do update set body_type_id = excluded.body_type_id
	`
}

async function run() {
	const vehicleTypeIdByName = new Map()
	const vehicleBrandIdByName = new Map()

	for (const name of vehicleTypes) {
		const id = await upsertVehicleType(name)
		if (!id) {
			throw new Error(`Failed to upsert vehicle type: ${name}`)
		}

		vehicleTypeIdByName.set(name, id)
	}

	for (const brand of brands) {
		const id = await upsertVehicleBrand(brand.name, brand.country)
		if (!id) {
			throw new Error(`Failed to upsert vehicle brand: ${brand.name}`)
		}

		vehicleBrandIdByName.set(brand.name, id)
	}

	for (const model of models) {
		const brandId = vehicleBrandIdByName.get(model.brandName)
		if (!brandId) {
			throw new Error(
				`Brand not found for model ${model.name}: ${model.brandName}`,
			)
		}

		const bodyTypeId = vehicleTypeIdByName.get(model.bodyTypeName) ?? null
		await upsertVehicleModel(brandId, model.name, bodyTypeId)
	}

	console.log(
		`Vehicle lookup seed complete: ${vehicleTypes.length} types, ${brands.length} brands, ${models.length} models.`,
	)
}

run().catch((error) => {
	console.error("Vehicle lookup seed failed.")
	console.error(error)
	process.exit(1)
})
