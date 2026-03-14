import type { Metadata } from "next"

import { RentalManagement } from "@/components/rentals/rental-management"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Rentals",
}

export default async function RentalsPage() {
	await requireWorkspacePermission({
		permission: "viewBookingsModule",
		reason: "rentals",
	})

	return <RentalManagement />
}
