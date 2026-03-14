import type { Metadata } from "next"

import { VehicleCatalogManagement } from "@/components/vehicles/vehicle-catalog-management"

export const metadata: Metadata = {
	title: "Vehicle Catalog",
}

export default async function VehicleCatalogPage() {
	return <VehicleCatalogManagement />
}
