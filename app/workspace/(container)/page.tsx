import type { Metadata } from "next"

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Dashboard",
}

export default async function DashboardPage() {
	await requireWorkspacePermission({
		permission: "viewDashboardModule",
		reason: "dashboard",
	})

	return <WorkspaceDashboard />
}
