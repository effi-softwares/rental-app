export const employeesQueryKeys = {
	all: ["employees"] as const,
	roles: (organizationId?: string) =>
		[...employeesQueryKeys.all, "roles", organizationId ?? ""] as const,
	roleDetails: (organizationId?: string, roleName?: string | null) =>
		[
			...employeesQueryKeys.all,
			"role-details",
			organizationId ?? "",
			roleName ?? "",
		] as const,
	members: (organizationId?: string) =>
		[...employeesQueryKeys.all, "members", organizationId ?? ""] as const,
	invitations: (organizationId?: string) =>
		[...employeesQueryKeys.all, "invitations", organizationId ?? ""] as const,
	employeeDetails: (organizationId?: string, memberId?: string | null) =>
		[
			...employeesQueryKeys.all,
			"employee-details",
			organizationId ?? "",
			memberId ?? "",
		] as const,
}
