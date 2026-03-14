export const vehiclesQueryKeys = {
	all: ["vehicles"] as const,
	list: (organizationId?: string) =>
		[...vehiclesQueryKeys.all, "list", organizationId ?? ""] as const,
	detail: (organizationId?: string, vehicleId?: string) =>
		[
			...vehiclesQueryKeys.all,
			"detail",
			organizationId ?? "",
			vehicleId ?? "",
		] as const,
	meta: (organizationId?: string) =>
		[...vehiclesQueryKeys.all, "meta", organizationId ?? ""] as const,
}
