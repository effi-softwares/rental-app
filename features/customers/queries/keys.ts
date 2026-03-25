export const customersQueryKeys = {
	all: ["customers"] as const,
	list: (
		organizationId?: string,
		filters?: {
			page: number
			pageSize: number
			search: string
			branchId: string
			verificationStatus: string
			status: string
		},
	) =>
		[
			...customersQueryKeys.all,
			"list",
			organizationId ?? "",
			filters?.page ?? 1,
			filters?.pageSize ?? 25,
			filters?.search ?? "",
			filters?.branchId ?? "",
			filters?.verificationStatus ?? "",
			filters?.status ?? "all",
		] as const,
	detail: (organizationId?: string, customerId?: string | null) =>
		[
			...customersQueryKeys.all,
			"detail",
			organizationId ?? "",
			customerId ?? "",
		] as const,
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
