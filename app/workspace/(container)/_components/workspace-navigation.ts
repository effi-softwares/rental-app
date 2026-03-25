import type { LucideIcon } from "lucide-react"
import {
	CalendarCheck2,
	CarFront,
	CreditCard,
	Images,
	LayoutDashboard,
	MapPinned,
	Settings,
	Users,
	Users2,
} from "lucide-react"

import { routes } from "@/config/routes"
import type { Permission } from "@/lib/authorization/policies"
import { isPrivilegedFleetRole } from "@/lib/fleet/live"

export type WorkspaceNavGroup = "workspace" | "operations" | "administration"

export type WorkspaceNavItem = {
	href: string
	label: string
	icon: LucideIcon
	group: WorkspaceNavGroup
	permission: Permission
	requiresPrivilegedFleetRole?: boolean
}

const workspaceNavGroupOrder: WorkspaceNavGroup[] = [
	"workspace",
	"operations",
	"administration",
]

const workspaceNavGroupLabels: Record<WorkspaceNavGroup, string> = {
	workspace: "Workspace",
	operations: "Operations",
	administration: "Administration",
}

export const workspaceNavigation: WorkspaceNavItem[] = [
	{
		href: routes.app.root,
		label: "Dashboard",
		group: "workspace",
		permission: "viewDashboardModule",
		icon: LayoutDashboard,
	},
	{
		href: routes.app.vehicleCatalog,
		label: "Vehicle Catalog",
		group: "workspace",
		permission: "viewFleetModule",
		icon: CarFront,
	},
	{
		href: routes.app.fleet,
		label: "Fleet Live",
		group: "workspace",
		permission: "viewFleetModule",
		requiresPrivilegedFleetRole: true,
		icon: MapPinned,
	},
	{
		href: routes.app.rentals,
		label: "Rentals",
		group: "operations",
		permission: "viewBookingsModule",
		icon: CalendarCheck2,
	},
	{
		href: routes.app.payments,
		label: "Payments",
		group: "operations",
		permission: "managePaymentsModule",
		icon: CreditCard,
	},
	{
		href: routes.app.billingAttention,
		label: "Billing Attention",
		group: "operations",
		permission: "manageBillingAttentionModule",
		icon: CreditCard,
	},
	{
		href: routes.app.gallery,
		label: "Gallery",
		group: "operations",
		permission: "viewGalleryModule",
		icon: Images,
	},
	// No need this for initial release
	// {
	// 	href: routes.app.branches,
	// 	label: "Branches",
	// 	group: "operations",
	// 	permission: "viewBranchModule",
	// 	icon: Building2,
	// },
	{
		href: routes.app.customers,
		label: "Customers",
		group: "operations",
		permission: "viewCustomerModule",
		icon: Users2,
	},
	{
		href: routes.app.employees,
		label: "Employees",
		group: "administration",
		permission: "viewEmployeesModule",
		icon: Users,
	},
	{
		href: routes.app.employeeRoles,
		label: "Role & Access",
		group: "administration",
		permission: "manageOrganizationSettings",
		icon: Settings,
	},
	{
		href: routes.app.settings,
		label: "Organization Settings",
		group: "administration",
		permission: "manageOrganizationSettings",
		icon: Settings,
	},
]

export function matchesWorkspacePath(pathname: string, href: string) {
	return (
		pathname === href || (href !== routes.app.root && pathname.startsWith(href))
	)
}

export function getActiveWorkspaceNavItem(
	pathname: string,
	items: WorkspaceNavItem[],
) {
	return (
		items.find((item) => matchesWorkspacePath(pathname, item.href)) ??
		items.find((item) => item.href === routes.app.root) ??
		null
	)
}

export function getVisibleWorkspaceNavigation(input: {
	permissions?: Record<Permission, boolean>
	viewerRole?: string | null
}) {
	if (!input.permissions) {
		return workspaceNavigation.filter(
			(item) => item.permission === "viewDashboardModule",
		)
	}

	return workspaceNavigation.filter((item) => {
		if (!input.permissions?.[item.permission]) {
			return false
		}

		if (item.requiresPrivilegedFleetRole) {
			return isPrivilegedFleetRole(input.viewerRole)
		}

		return true
	})
}

export function getGroupedWorkspaceNavigation(items: WorkspaceNavItem[]) {
	return workspaceNavGroupOrder
		.map((group) => ({
			group,
			label: workspaceNavGroupLabels[group],
			items: items.filter((item) => item.group === group),
		}))
		.filter((group) => group.items.length > 0)
}
