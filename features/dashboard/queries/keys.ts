export const dashboardQueryKeys = {
	all: ["dashboard"] as const,
	overview: (organizationId?: string) =>
		[...dashboardQueryKeys.all, "overview", organizationId ?? ""] as const,
}
