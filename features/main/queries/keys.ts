export const mainQueryKeys = {
	all: ["main"] as const,
	authContext: () => [...mainQueryKeys.all, "auth-context"] as const,
	permissions: (organizationId: string) =>
		[...mainQueryKeys.all, "permissions", organizationId] as const,
	organization: (organizationId: string) =>
		[...mainQueryKeys.all, "org", organizationId] as const,
	organizations: () => [...mainQueryKeys.all, "organizations"] as const,
}
