import type { Metadata } from "next"

import { BranchManagement } from "@/components/branches/branch-management"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Branches",
}

export default async function BranchesPage() {
	await requireWorkspacePermission({
		permission: "viewBranchModule",
		reason: "branches",
	})

	return <BranchManagement />
}
