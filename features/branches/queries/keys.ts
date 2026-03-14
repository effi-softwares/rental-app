export const branchesQueryKeys = {
	all: ["branches"] as const,
	list: (organizationId?: string) =>
		[...branchesQueryKeys.all, organizationId ?? ""] as const,
	members: (organizationId?: string) =>
		[...branchesQueryKeys.all, "members", organizationId ?? ""] as const,
}
