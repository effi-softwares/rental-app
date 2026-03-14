export const fleetQueryKeys = {
	all: ["fleet"] as const,
	live: (organizationId?: string) =>
		[...fleetQueryKeys.all, "live", organizationId ?? ""] as const,
	vehicle: (organizationId?: string, vehicleId?: string, hours = 1) =>
		[
			...fleetQueryKeys.all,
			"vehicle",
			organizationId ?? "",
			vehicleId ?? "",
			String(hours),
		] as const,
	vehiclePrefix: (organizationId?: string, vehicleId?: string) =>
		[
			...fleetQueryKeys.all,
			"vehicle",
			organizationId ?? "",
			vehicleId ?? "",
		] as const,
	vehicleOrganizationPrefix: (organizationId?: string) =>
		[...fleetQueryKeys.all, "vehicle", organizationId ?? ""] as const,
}
