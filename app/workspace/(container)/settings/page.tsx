import type { Metadata } from "next"

import { OrganizationSettingsPanel } from "@/components/organizations/organization-settings-panel"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Organization Settings",
}

export default async function OrganizationSettingsPage() {
	await requireWorkspacePermission({
		permission: "manageOrganizationSettings",
		reason: "organizationSettings",
	})

	return <OrganizationSettingsPanel />
}
