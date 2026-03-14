import { routes } from "@/config/routes"

export type ForbiddenReason =
	| "dashboard"
	| "profile"
	| "employees"
	| "roleAccess"
	| "vehicleCatalog"
	| "fleetLive"
	| "branches"
	| "gallery"
	| "rentals"
	| "payments"
	| "billingAttention"
	| "customers"
	| "organizationSettings"

type ForbiddenContent = {
	title: string
	description: string
}

const forbiddenReasonSet = new Set<ForbiddenReason>([
	"dashboard",
	"profile",
	"employees",
	"roleAccess",
	"vehicleCatalog",
	"fleetLive",
	"branches",
	"gallery",
	"rentals",
	"payments",
	"billingAttention",
	"customers",
	"organizationSettings",
])

export const forbiddenContentByReason: Record<
	ForbiddenReason | "default",
	ForbiddenContent
> = {
	default: {
		title: "Forbidden",
		description:
			"You do not have permission to view this page in the active organization.",
	},
	dashboard: {
		title: "Dashboard access restricted",
		description:
			"Your role does not have access to the dashboard in this organization.",
	},
	profile: {
		title: "Profile access restricted",
		description:
			"Your role does not have access to the profile and security section in this organization.",
	},
	employees: {
		title: "Employee management restricted",
		description:
			"Your role does not have access to employee management in this organization.",
	},
	roleAccess: {
		title: "Role & Access restricted",
		description:
			"Organization settings permission is required to manage roles and access.",
	},
	vehicleCatalog: {
		title: "Vehicle catalog restricted",
		description:
			"Your role does not have access to fleet and vehicle catalog workflows.",
	},
	fleetLive: {
		title: "Live fleet tracking restricted",
		description:
			"Only organization owners and admins can access live vehicle tracking.",
	},
	branches: {
		title: "Branches module restricted",
		description:
			"Your role does not have access to branch and location settings.",
	},
	gallery: {
		title: "Gallery module restricted",
		description: "Your role does not have access to the organization gallery.",
	},
	rentals: {
		title: "Rentals restricted",
		description: "Your role does not have access to rental workflows.",
	},
	payments: {
		title: "Payments restricted",
		description:
			"Your role does not have access to payments operations in this organization.",
	},
	billingAttention: {
		title: "Billing Attention restricted",
		description:
			"Your role does not have access to billing attention in this organization.",
	},
	customers: {
		title: "Customers module restricted",
		description:
			"Your role does not have access to customer profile and verification workflows.",
	},
	organizationSettings: {
		title: "Organization settings restricted",
		description:
			"Your role does not have access to organization settings in this organization.",
	},
}

export function parseForbiddenReason(
	value: string | string[] | undefined,
): ForbiddenReason | null {
	if (typeof value !== "string") {
		return null
	}

	return forbiddenReasonSet.has(value as ForbiddenReason)
		? (value as ForbiddenReason)
		: null
}

export function buildForbiddenHref(reason?: ForbiddenReason) {
	if (!reason) {
		return routes.errors.forbidden
	}

	return `${routes.errors.forbidden}?reason=${encodeURIComponent(reason)}`
}
