import { createAccessControl } from "better-auth/plugins/access"
import {
	adminAc,
	defaultStatements,
	memberAc,
	ownerAc,
} from "better-auth/plugins/organization/access"

export type OrganizationRole = string

export type Permission =
	| "viewDashboardModule"
	| "manageOrganizationSettings"
	| "manageOrganizationVisibility"
	| "viewGalleryModule"
	| "manageGalleryMedia"
	| "viewEmployeesModule"
	| "inviteEmployees"
	| "manageEmployeeRoles"
	| "removeEmployees"
	| "viewBranchModule"
	| "manageBranches"
	| "manageLocationAccess"
	| "viewCustomerModule"
	| "manageCustomers"
	| "manageCustomerNotes"
	| "viewFleetModule"
	| "manageVehicles"
	| "viewBookingsModule"
	| "viewReportsModule"
	| "managePaymentsModule"
	| "manageBillingAttentionModule"

type FeatureModule = {
	key: string
	label: string
	description: string
	permission: Permission
}

const appStatements = {
	dashboard: ["view"],
	organizationSettings: ["manage", "visibility"],
	gallery: ["view", "manage"],
	employees: ["view", "invite", "manage-role", "remove"],
	branches: ["view", "manage", "manage-access"],
	customers: ["view", "manage", "notes"],
	fleet: ["view", "manage"],
	bookings: ["view"],
	reports: ["view"],
	payments: ["manage"],
	billingAttention: ["manage"],
} as const

export const organizationAccessControl = createAccessControl({
	...defaultStatements,
	...appStatements,
})

export const permissionRequirements: Record<
	Permission,
	Record<string, string[]>
> = {
	viewDashboardModule: {
		dashboard: ["view"],
	},
	manageOrganizationSettings: {
		organizationSettings: ["manage"],
	},
	manageOrganizationVisibility: {
		organizationSettings: ["visibility"],
	},
	viewGalleryModule: {
		gallery: ["view"],
	},
	manageGalleryMedia: {
		gallery: ["manage"],
	},
	viewEmployeesModule: {
		employees: ["view"],
	},
	inviteEmployees: {
		employees: ["invite"],
	},
	manageEmployeeRoles: {
		employees: ["manage-role"],
	},
	removeEmployees: {
		employees: ["remove"],
	},
	viewBranchModule: {
		branches: ["view"],
	},
	manageBranches: {
		branches: ["manage"],
	},
	manageLocationAccess: {
		branches: ["manage-access"],
	},
	viewCustomerModule: {
		customers: ["view"],
	},
	manageCustomers: {
		customers: ["manage"],
	},
	manageCustomerNotes: {
		customers: ["notes"],
	},
	viewFleetModule: {
		fleet: ["view"],
	},
	manageVehicles: {
		fleet: ["manage"],
	},
	viewBookingsModule: {
		bookings: ["view"],
	},
	viewReportsModule: {
		reports: ["view"],
	},
	managePaymentsModule: {
		payments: ["manage"],
	},
	manageBillingAttentionModule: {
		billingAttention: ["manage"],
	},
}

export function mergePermissionRequirements(permissions: Permission[]) {
	const statements: Record<string, string[]> = {}

	for (const permission of permissions) {
		const requirement = permissionRequirements[permission]

		for (const [resource, actions] of Object.entries(requirement)) {
			const existingActions = statements[resource] ?? []
			statements[resource] = [...new Set([...existingActions, ...actions])]
		}
	}

	return statements
}

export function resolvePermissionKeysFromStatements(
	statements?: Record<string, string[]>,
): Permission[] {
	if (!statements) {
		return []
	}

	return (Object.keys(permissionRequirements) as Permission[]).filter(
		(permission) => {
			const requirement = permissionRequirements[permission]

			return Object.entries(requirement).every(
				([resource, requiredActions]) => {
					const assignedActions = statements[resource] ?? []
					return requiredActions.every((action) =>
						assignedActions.includes(action),
					)
				},
			)
		},
	)
}

const ownerPermissions: Permission[] = [
	"viewDashboardModule",
	"manageOrganizationSettings",
	"manageOrganizationVisibility",
	"viewGalleryModule",
	"manageGalleryMedia",
	"viewEmployeesModule",
	"inviteEmployees",
	"manageEmployeeRoles",
	"removeEmployees",
	"viewBranchModule",
	"manageBranches",
	"manageLocationAccess",
	"viewCustomerModule",
	"manageCustomers",
	"manageCustomerNotes",
	"viewFleetModule",
	"manageVehicles",
	"viewBookingsModule",
	"viewReportsModule",
	"managePaymentsModule",
	"manageBillingAttentionModule",
]

const adminPermissions: Permission[] = [
	"viewDashboardModule",
	"manageOrganizationSettings",
	"viewGalleryModule",
	"manageGalleryMedia",
	"viewEmployeesModule",
	"inviteEmployees",
	"viewBranchModule",
	"manageBranches",
	"manageLocationAccess",
	"viewCustomerModule",
	"manageCustomers",
	"manageCustomerNotes",
	"viewFleetModule",
	"manageVehicles",
	"viewBookingsModule",
	"viewReportsModule",
]

const memberPermissions: Permission[] = [
	"viewDashboardModule",
	"viewGalleryModule",
	"viewBranchModule",
]

export const defaultRolePolicyMap: Record<
	"owner" | "admin" | "member",
	Permission[]
> = {
	owner: [...ownerPermissions],
	admin: [...adminPermissions],
	member: [...memberPermissions],
}

const staticRolePermissions: Record<
	"owner" | "admin" | "member",
	ReadonlySet<Permission>
> = {
	owner: new Set<Permission>(defaultRolePolicyMap.owner),
	admin: new Set<Permission>(defaultRolePolicyMap.admin),
	member: new Set<Permission>(defaultRolePolicyMap.member),
}

export const organizationRoles = {
	owner: organizationAccessControl.newRole({
		...ownerAc.statements,
		...mergePermissionRequirements(ownerPermissions),
	}),
	admin: organizationAccessControl.newRole({
		...adminAc.statements,
		...mergePermissionRequirements(adminPermissions),
	}),
	member: organizationAccessControl.newRole({
		...memberAc.statements,
		...mergePermissionRequirements(memberPermissions),
	}),
}

export const featureModules: FeatureModule[] = [
	{
		key: "dashboard",
		label: "Dashboard",
		description: "Operational summary and daily activity.",
		permission: "viewDashboardModule",
	},
	{
		key: "gallery",
		label: "Gallery",
		description: "Organization media gallery and shared images.",
		permission: "viewGalleryModule",
	},
	{
		key: "employees",
		label: "Employees",
		description: "Organization members and invitations.",
		permission: "viewEmployeesModule",
	},
	{
		key: "branches",
		label: "Branches",
		description: "Location and branch operations.",
		permission: "viewBranchModule",
	},
	{
		key: "customers",
		label: "Customers",
		description: "Customer records and profile data.",
		permission: "viewCustomerModule",
	},
	{
		key: "fleet",
		label: "Fleet",
		description: "Vehicle inventory and maintenance states.",
		permission: "viewFleetModule",
	},
	{
		key: "bookings",
		label: "Bookings",
		description: "Rental lifecycle and booking workflows.",
		permission: "viewBookingsModule",
	},
	{
		key: "reports",
		label: "Reports",
		description: "Utilization and revenue reporting.",
		permission: "viewReportsModule",
	},
	{
		key: "payments",
		label: "Payments",
		description: "Payment operations, invoices, refunds, and collection flows.",
		permission: "managePaymentsModule",
	},
	{
		key: "billingAttention",
		label: "Billing Attention",
		description: "Billing alerts, webhook health, and attention monitoring.",
		permission: "manageBillingAttentionModule",
	},
]

export function normalizeOrganizationRole(
	value?: string | null,
): OrganizationRole {
	return value?.split(",")[0]?.trim() || "member"
}

export function hasPermission(
	role: OrganizationRole,
	permission: Permission,
): boolean {
	if (role === "owner" || role === "admin" || role === "member") {
		return staticRolePermissions[role].has(permission)
	}

	return false
}
