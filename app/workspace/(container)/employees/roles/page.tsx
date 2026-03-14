import type { Metadata } from "next"

import { RoleAccessManagement } from "@/components/employees/role-access-management"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Role & Access",
}

export default async function EmployeeRoleAccessPage() {
	await requireWorkspacePermission({
		permission: "manageOrganizationSettings",
		reason: "roleAccess",
	})

	return <RoleAccessManagement />
}
