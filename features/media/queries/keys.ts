export const mediaQueryKeys = {
	all: ["media"] as const,
	list: (
		organizationId: string,
		entityType?: string,
		entityId?: string,
		field?: string,
	) =>
		[
			"media",
			organizationId,
			entityType ?? "",
			entityId ?? "",
			field ?? "",
		] as const,
}
