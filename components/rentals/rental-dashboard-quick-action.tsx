"use client"

import { HandCoins } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { RentalAppointmentDrawer } from "./rental-appointment-drawer"

export function RentalDashboardQuickAction() {
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? null
	const canCreateRentals = Boolean(
		authContextQuery.data?.permissions.viewBookingsModule,
	)
	const [isOpen, setIsOpen] = useState(false)

	if (!activeOrganizationId || !canCreateRentals) {
		return null
	}

	return (
		<section className="space-y-3 rounded-xl border px-4 py-4">
			<div className="space-y-1">
				<p className="text-sm font-medium">Rental operations</p>
				<p className="text-muted-foreground text-xs">
					Create a new rental from dashboard and complete billing setup.
				</p>
			</div>
			<Button type="button" className="h-11" onClick={() => setIsOpen(true)}>
				<HandCoins />
				New rental
			</Button>

			<RentalAppointmentDrawer open={isOpen} onOpenChange={setIsOpen} />
		</section>
	)
}
