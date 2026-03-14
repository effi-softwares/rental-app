import { and, asc, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import {
	getScopedBranchIdsForViewer,
	viewerHasPermission,
} from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { member } from "@/lib/db/schema/auth"
import { branch, memberBranchAccess } from "@/lib/db/schema/branches"

type BranchResponse = {
	id: string
	name: string
	code: string
	address: string | null
	isActive: boolean
	createdAt: string
}

function normalizeBranchRecord(
	record: typeof branch.$inferSelect,
): BranchResponse {
	return {
		id: record.id,
		name: record.name,
		code: record.code,
		address: record.address,
		isActive: record.isActive,
		createdAt: record.createdAt.toISOString(),
	}
}

export async function GET() {
	const guard = await requireViewer({ permission: "viewBranchModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const [canManageBranches, canManageLocationAccess, scopedBranchIds] =
		await Promise.all([
			viewerHasPermission(viewer, "manageBranches"),
			viewerHasPermission(viewer, "manageLocationAccess"),
			getScopedBranchIdsForViewer(viewer),
		])
	const organizationId = viewer.activeOrganizationId

	if (scopedBranchIds !== null) {
		const membership = await db
			.select({
				id: member.id,
			})
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, viewer.userId),
				),
			)
			.limit(1)

		const memberId = membership[0]?.id
		if (!memberId) {
			return NextResponse.json({
				branches: [],
				branchAccess: [],
				canManageBranches,
				canManageLocationAccess,
			})
		}

		const scopedAccessRows = await db
			.select({
				id: memberBranchAccess.id,
				branchId: memberBranchAccess.branchId,
				memberId: memberBranchAccess.memberId,
			})
			.from(memberBranchAccess)
			.where(
				and(
					eq(memberBranchAccess.organizationId, organizationId),
					eq(memberBranchAccess.memberId, memberId),
				),
			)

		const scopedBranchIdsForMember = scopedAccessRows.map((row) => row.branchId)

		if (scopedBranchIdsForMember.length === 0) {
			return NextResponse.json({
				branches: [],
				branchAccess: [],
				canManageBranches,
				canManageLocationAccess,
			})
		}

		const branchRows = await db
			.select()
			.from(branch)
			.where(
				and(
					eq(branch.organizationId, organizationId),
					inArray(branch.id, scopedBranchIdsForMember),
				),
			)
			.orderBy(asc(branch.name))

		return NextResponse.json({
			branches: branchRows.map(normalizeBranchRecord),
			branchAccess: scopedAccessRows,
			canManageBranches,
			canManageLocationAccess,
		})
	}

	const [branchRows, branchAccessRows] = await Promise.all([
		db
			.select()
			.from(branch)
			.where(eq(branch.organizationId, organizationId))
			.orderBy(asc(branch.name)),
		db
			.select()
			.from(memberBranchAccess)
			.where(eq(memberBranchAccess.organizationId, organizationId)),
	])

	return NextResponse.json({
		branches: branchRows.map(normalizeBranchRecord),
		branchAccess: branchAccessRows,
		canManageBranches,
		canManageLocationAccess,
	})
}

export async function POST(request: Request) {
	const guard = await requireViewer({ permission: "manageBranches" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const payload = (await request.json()) as {
		name?: string
		code?: string
		address?: string
	}

	const name = payload.name?.trim()
	const code = payload.code?.trim().toUpperCase()
	const address = payload.address?.trim() || null

	if (!name || !code) {
		return jsonError("Branch name and code are required.", 400)
	}

	try {
		const created = await db
			.insert(branch)
			.values({
				organizationId: viewer.activeOrganizationId,
				name,
				code,
				address,
			})
			.returning()

		return NextResponse.json(
			{ branch: normalizeBranchRecord(created[0]) },
			{ status: 201 },
		)
	} catch {
		return jsonError(
			"Unable to create branch. Ensure code is unique per organization.",
			400,
		)
	}
}
