import type { Metadata } from "next"

import { RentalDetails } from "@/components/rentals/rental-details"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Rental Details",
}

type RentalDetailsPageProps = {
	params: Promise<{
		rentalId: string
	}>
}

export default async function RentalDetailsPage({
	params,
}: RentalDetailsPageProps) {
	await requireWorkspacePermission({
		permission: "viewBookingsModule",
		reason: "rentals",
	})

	const { rentalId } = await params

	return <RentalDetails rentalId={rentalId} />
}
