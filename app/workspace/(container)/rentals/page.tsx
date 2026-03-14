import type { Metadata } from "next"

import { RentalManagement } from "@/components/rentals/rental-management"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Rentals",
}

type RentalsPageProps = {
	searchParams?: Promise<{
		status?: string | string[]
	}>
}

export default async function RentalsPage({ searchParams }: RentalsPageProps) {
	await requireWorkspacePermission({
		permission: "viewBookingsModule",
		reason: "rentals",
	})

	const resolvedSearchParams = searchParams ? await searchParams : undefined
	const statusValue = resolvedSearchParams?.status
	const statusPreset =
		typeof statusValue === "string"
			? statusValue
			: Array.isArray(statusValue)
				? statusValue.join(",")
				: undefined

	return <RentalManagement statusPreset={statusPreset} />
}
