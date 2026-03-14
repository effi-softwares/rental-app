import type { Metadata } from "next"

import { VehicleDetails } from "@/components/vehicles/vehicle-details"

export const metadata: Metadata = {
	title: "Vehicle Details",
}

type VehicleDetailsPageProps = {
	params: Promise<{
		vehicleId: string
	}>
}

export default async function VehicleDetailsPage({
	params,
}: VehicleDetailsPageProps) {
	const { vehicleId } = await params

	return <VehicleDetails vehicleId={vehicleId} />
}
