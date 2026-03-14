import type { Metadata } from "next"

import { CustomerManagement } from "@/components/customers/customer-management"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Customers",
}

export default async function CustomersPage() {
	await requireWorkspacePermission({
		permission: "viewCustomerModule",
		reason: "customers",
	})

	return <CustomerManagement />
}
