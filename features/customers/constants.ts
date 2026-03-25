export const CUSTOMER_VERIFICATION_STATUSES = [
	"pending",
	"in_review",
	"verified",
	"rejected",
] as const

export const CUSTOMER_STATUSES = ["active", "banned"] as const

export type CustomerVerificationStatus =
	(typeof CUSTOMER_VERIFICATION_STATUSES)[number]

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]
