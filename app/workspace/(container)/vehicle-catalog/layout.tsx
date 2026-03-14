import type { ReactNode } from "react"

import { requireWorkspacePermission } from "@/lib/authorization/server"

type VehicleCatalogLayoutProps = {
	children: ReactNode
}

export default async function VehicleCatalogLayout({
	children,
}: VehicleCatalogLayoutProps) {
	await requireWorkspacePermission({
		permission: "viewFleetModule",
		reason: "vehicleCatalog",
	})

	return children
}
