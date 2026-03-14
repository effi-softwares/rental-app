export const customersQueryKeys = {
	all: ["customers"] as const,
	list: (organizationId?: string) =>
		[...customersQueryKeys.all, organizationId ?? ""] as const,
	lookup: (organizationId?: string, email?: string, phone?: string) =>
		[
			...customersQueryKeys.all,
			"lookup",
			organizationId ?? "",
			email ?? "",
			phone ?? "",
		] as const,
	notes: (organizationId?: string, customerId?: string | null) =>
		[
			...customersQueryKeys.all,
			"notes",
			organizationId ?? "",
			customerId ?? "",
		] as const,
}
