import type {
	CustomerStatus,
	CustomerVerificationStatus,
} from "@/features/customers/constants"

export type CustomerBranchOption = {
	id: string
	name: string
	code: string
}

export type CustomerListRow = {
	id: string
	fullName: string
	email: string | null
	phone: string | null
	branchId: string | null
	branchName: string | null
	verificationStatus: CustomerVerificationStatus
	status: CustomerStatus
	bannedAt: string | null
	createdAt: string
	updatedAt: string
}

export type CustomerListFilters = {
	page: number
	pageSize: number
	search: string
	branchId: string
	verificationStatus: string
	status: "active" | "banned" | "all"
}

export type CustomerListResponse = {
	rows: CustomerListRow[]
	page: {
		page: number
		pageSize: number
		total: number
		pageCount: number
	}
	filters: CustomerListFilters
	meta: {
		branches: CustomerBranchOption[]
		canManageCustomers: boolean
		summary: {
			total: number
			active: number
			banned: number
			verified: number
		}
	}
}

export type CustomerDetail = {
	id: string
	fullName: string
	email: string | null
	phone: string | null
	branchId: string | null
	branchName: string | null
	verificationStatus: CustomerVerificationStatus
	verificationMetadata: Record<string, unknown>
	status: CustomerStatus
	bannedAt: string | null
	createdAt: string
	updatedAt: string
}

export type CustomerDetailResponse = {
	customer: CustomerDetail
	hasRentalHistory: boolean
}
