import type { Metadata } from "next"

import { ProfileSecurityPanel } from "@/components/profile/profile-security-panel"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Profile",
}

export default async function ProfilePage() {
	await requireWorkspacePermission({
		permission: "viewDashboardModule",
		reason: "profile",
	})

	return <ProfileSecurityPanel />
}
