import { and, eq } from "drizzle-orm"

import { getScopedBranchIdsForViewer } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import type { Context } from "@/types"

export async function isBranchInOrganization(
	organizationId: string,
	branchId: string,
) {
	const rows = await db
		.select({ id: branch.id })
		.from(branch)
		.where(
			and(eq(branch.organizationId, organizationId), eq(branch.id, branchId)),
		)
		.limit(1)

	return Boolean(rows[0])
}

export async function viewerCanAccessBranch(
	viewer: Context,
	branchId: string | null,
) {
	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)

	if (scopedBranchIds === null) {
		return true
	}

	if (!branchId) {
		return false
	}

	return scopedBranchIds.includes(branchId)
}
