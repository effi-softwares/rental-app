export const rentalsQueryKeys = {
	all: ["rentals"] as const,
	list: (organizationId?: string, statusFilter?: string) =>
		[
			...rentalsQueryKeys.all,
			"list",
			organizationId ?? "",
			statusFilter ?? "",
		] as const,
	detail: (organizationId?: string, rentalId?: string | null) =>
		[
			...rentalsQueryKeys.all,
			"detail",
			organizationId ?? "",
			rentalId ?? "",
		] as const,
	availability: (
		organizationId?: string,
		input?: {
			vehicleId?: string | null
			rentalId?: string | null
			startsAt?: string | null
			endsAt?: string | null
			matchMode?: string | null
		},
	) =>
		[
			...rentalsQueryKeys.all,
			"availability",
			organizationId ?? "",
			input?.vehicleId ?? "",
			input?.rentalId ?? "",
			input?.startsAt ?? "",
			input?.endsAt ?? "",
			input?.matchMode ?? "",
		] as const,
}
