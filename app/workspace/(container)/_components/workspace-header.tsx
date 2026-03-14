"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { ProfileMenu } from "./profile-menu"
import { useWorkspaceLiveStatus } from "./workspace-live-provider"
import {
	getActiveWorkspaceNavItem,
	getVisibleWorkspaceNavigation,
} from "./workspace-navigation"

export function WorkspaceHeader() {
	const pathname = usePathname()
	const authContextQuery = useAuthContextQuery()
	const liveStatus = useWorkspaceLiveStatus()

	const visibleNavigation = useMemo(() => {
		return getVisibleWorkspaceNavigation({
			permissions: authContextQuery.data?.permissions,
			viewerRole: authContextQuery.data?.viewer.role,
		})
	}, [authContextQuery.data?.permissions, authContextQuery.data?.viewer.role])

	const activeSectionLabel = useMemo(() => {
		return (
			getActiveWorkspaceNavItem(pathname, visibleNavigation)?.label ??
			"Dashboard"
		)
	}, [pathname, visibleNavigation])

	return (
		<header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-20 border-b backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
			{liveStatus.latestAlert ? (
				<div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 md:px-6 xl:px-8">
					<p className="text-sm font-medium text-destructive">
						{liveStatus.latestAlert.summary ?? "Billing Attention required."}
					</p>
				</div>
			) : null}
			<div className="flex h-16 shrink-0 items-center gap-2">
				<div className="flex items-center gap-2 px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-1" />
					<div className="hidden min-w-0 md:block">
						<p className="truncate text-sm font-medium">{activeSectionLabel}</p>
						<p className="text-muted-foreground truncate text-xs">
							{authContextQuery.data?.activeOrganization?.name ??
								"Organization"}
						</p>
					</div>
				</div>

				<div className="ml-auto -mr-1 px-4 md:px-6 xl:px-8">
					<ProfileMenu />
				</div>
			</div>
		</header>
	)
}
