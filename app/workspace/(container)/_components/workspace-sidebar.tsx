"use client"

import { LayoutGrid } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { Badge } from "@/components/ui/badge"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar"
import { isPlatformSignupEnabled } from "@/config/feature-flags"
import { routes } from "@/config/routes"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { OrganizationSwitcher } from "./organization-switcher"
import { useWorkspaceLiveStatus } from "./workspace-live-provider"
import {
	getGroupedWorkspaceNavigation,
	getVisibleWorkspaceNavigation,
	matchesWorkspacePath,
	type WorkspaceNavItem,
} from "./workspace-navigation"

export function WorkspaceSidebar() {
	const pathname = usePathname()
	const authContextQuery = useAuthContextQuery()
	const liveStatus = useWorkspaceLiveStatus()

	const viewerRole = authContextQuery.data?.viewer.role ?? "member"
	const visibleNavigation = useMemo(() => {
		return getVisibleWorkspaceNavigation({
			permissions: authContextQuery.data?.permissions,
			viewerRole,
		})
	}, [authContextQuery.data?.permissions, viewerRole])
	const groupedNavigation = useMemo(() => {
		return getGroupedWorkspaceNavigation(visibleNavigation)
	}, [visibleNavigation])

	function renderLink(item: WorkspaceNavItem) {
		const LinkIcon = item.icon
		const isActive = matchesWorkspacePath(pathname, item.href)

		return (
			<SidebarMenuItem key={item.href}>
				<SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
					<Link href={item.href}>
						<LinkIcon />
						<span>{item.label}</span>
						{item.href === routes.app.billingAttention &&
						liveStatus.billingAttentionCount > 0 ? (
							<Badge variant="destructive" className="ml-auto text-[10px]">
								{liveStatus.billingAttentionCount}
							</Badge>
						) : null}
						{item.href === routes.app.rentals &&
						liveStatus.rentalAttentionCount > 0 ? (
							<Badge variant="secondary" className="ml-auto text-[10px]">
								{liveStatus.rentalAttentionCount}
							</Badge>
						) : null}
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		)
	}

	return (
		<Sidebar variant="sidebar" collapsible="offcanvas">
			<SidebarHeader className="gap-3">
				<div className=" p-2">
					<div className="flex items-center gap-2">
						<div className="bg-sidebar-primary/15 text-sidebar-primary inline-flex size-8 items-center justify-center rounded-md">
							<LayoutGrid className="size-2" />
						</div>
						<div>
							<p className="text-sm font-medium leading-tight">Rental Ops</p>
							<p className="text-sidebar-foreground/70 text-xs leading-tight">
								Dashboard workspace
							</p>
						</div>
					</div>
				</div>
				{isPlatformSignupEnabled ? <OrganizationSwitcher /> : null}
			</SidebarHeader>
			<SidebarContent>
				{groupedNavigation.map((group) => (
					<SidebarGroup key={group.group}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => renderLink(item))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter>
				<div className="p-2 w-full flex items-center gap-2 border-t ">
					<AnimatedThemeToggler className="ml-auto" />
				</div>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	)
}
