export const routes = {
	home: "/",
	setup: "/setup",
	auth: {
		signIn: "/sign-in",
		signUp: "/sign-up",
		signUpOnboarding: "/sign-up/onboarding",
		twoFactor: "/two-factor",
	},
	errors: {
		forbidden: "/forbidden",
	},
	app: {
		root: "/workspace",
		profile: "/workspace/profile",
		vehicleCatalog: "/workspace/vehicle-catalog",
		vehicleDetails: (vehicleId: string) =>
			`/workspace/vehicle-catalog/${vehicleId}`,
		fleet: "/workspace/fleet",
		rentals: "/workspace/rentals",
		rentalDetails: (rentalId: string) => `/workspace/rentals/${rentalId}`,
		billingAttention: "/workspace/billing-attention",
		payments: "/workspace/payments",
		settings: "/workspace/settings",
		gallery: "/workspace/gallery",
		branches: "/workspace/branches",
		customers: "/workspace/customers",
		employees: "/workspace/employees",
		employeeInvitations: "/workspace/employees/invitations",
		employeeRoles: "/workspace/employees/roles",
		employeeDetails: (memberId: string) => `/workspace/employees/${memberId}`,
	},
	invitations: {
		accept: (invitationId: string) => `/invitation/${invitationId}/accept`,
		setup: (invitationId: string) => `/invitation/${invitationId}/setup`,
	},
}
