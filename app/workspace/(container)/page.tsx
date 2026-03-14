import type { Metadata } from "next"

import { RentalDashboardQuickAction } from "@/components/rentals/rental-dashboard-quick-action"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { PageContentShell } from "@/components/ui/page-content-shell"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Dashboard",
}

export default async function DashboardPage() {
	const resolved = await requireWorkspacePermission({
		permission: "viewDashboardModule",
		reason: "dashboard",
	})

	const userName = resolved.user?.name ?? "Owner"
	const userEmail = resolved.user?.email ?? "-"
	const viewerRole = resolved.viewer.role ?? "member"

	return (
		<PageContentShell>
			<PageSectionHeader
				title="Dashboard"
				description="View your profile and module access for the active organization."
			/>

			<RentalDashboardQuickAction />

			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Owner profile</CardTitle>
						<CardDescription>
							Authenticated account information.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<p>
							<span className="text-muted-foreground">Name:</span> {userName}
						</p>
						<p>
							<span className="text-muted-foreground">Email:</span> {userEmail}
						</p>
						<p>
							<span className="text-muted-foreground">Role:</span> {viewerRole}
						</p>
					</CardContent>
				</Card>
			</div>
		</PageContentShell>
	)
}
