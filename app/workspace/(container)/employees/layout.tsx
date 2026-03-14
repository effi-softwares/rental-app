import type { ReactNode } from "react"

import { requireWorkspacePermission } from "@/lib/authorization/server"

type EmployeesModuleLayoutProps = {
	children: ReactNode
}

export default async function EmployeesModuleLayout({
	children,
}: EmployeesModuleLayoutProps) {
	await requireWorkspacePermission({
		permission: "viewEmployeesModule",
		reason: "employees",
	})

	return children
}
