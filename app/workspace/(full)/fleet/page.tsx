import type { Metadata } from "next"

import { FleetLiveManagement } from "@/components/fleet/fleet-live-management"
import { requirePrivilegedFleetAccess } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Fleet",
}

export default async function FleetPage() {
	await requirePrivilegedFleetAccess("fleetLive")

	return <FleetLiveManagement />
}
