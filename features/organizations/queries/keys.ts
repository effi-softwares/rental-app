export const organizationsQueryKeys = {
	all: ["organization-settings"] as const,
	current: () => [...organizationsQueryKeys.all, "current"] as const,
}
