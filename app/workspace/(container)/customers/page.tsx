import type { Metadata } from "next"

import { CustomerManagement } from "@/components/customers/customer-management"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Customers",
}

type CustomersPageProps = {
	searchParams?: Promise<{
		page?: string | string[]
		pageSize?: string | string[]
		search?: string | string[]
		branchId?: string | string[]
		verificationStatus?: string | string[]
		status?: string | string[]
	}>
}

function resolveSearchParam(
	value: string | string[] | undefined,
): string | undefined {
	if (typeof value === "string") {
		return value
	}

	if (Array.isArray(value)) {
		return value.join(",")
	}

	return undefined
}

export default async function CustomersPage({
	searchParams,
}: CustomersPageProps) {
	await requireWorkspacePermission({
		permission: "viewCustomerModule",
		reason: "customers",
	})

	const resolvedSearchParams = searchParams ? await searchParams : undefined

	return (
		<CustomerManagement
			initialPage={resolveSearchParam(resolvedSearchParams?.page)}
			initialPageSize={resolveSearchParam(resolvedSearchParams?.pageSize)}
			initialSearch={resolveSearchParam(resolvedSearchParams?.search)}
			initialBranchId={resolveSearchParam(resolvedSearchParams?.branchId)}
			initialVerificationStatus={resolveSearchParam(
				resolvedSearchParams?.verificationStatus,
			)}
			initialStatus={resolveSearchParam(resolvedSearchParams?.status)}
		/>
	)
}
