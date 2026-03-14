import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { member } from "@/lib/db/schema/auth"
import { branch, memberBranchAccess } from "@/lib/db/schema/branches"

type Payload = {
	branchId?: string
	memberId?: string
}

export async function POST(request: Request) {
	const guard = await requireViewer({ permission: "manageLocationAccess" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const payload = (await request.json()) as Payload
	const branchId = payload.branchId
	const memberId = payload.memberId

	if (!branchId || !memberId) {
		return jsonError("branchId and memberId are required.", 400)
	}

	const organizationId = viewer.activeOrganizationId

	const [branchExists, memberExists] = await Promise.all([
		db
			.select({ id: branch.id })
			.from(branch)
			.where(
				and(eq(branch.id, branchId), eq(branch.organizationId, organizationId)),
			)
			.limit(1),
		db
			.select({ id: member.id, role: member.role })
			.from(member)
			.where(
				and(eq(member.id, memberId), eq(member.organizationId, organizationId)),
			)
			.limit(1),
	])

	if (!branchExists[0] || !memberExists[0]) {
		return jsonError("Branch or member not found.", 404)
	}

	if (memberExists[0].role === "owner") {
		return jsonError("Owner access is global and cannot be scoped.", 400)
	}

	try {
		await db.insert(memberBranchAccess).values({
			organizationId,
			branchId,
			memberId,
		})

		return NextResponse.json({ success: true }, { status: 201 })
	} catch {
		return jsonError("Access mapping already exists.", 400)
	}
}

export async function DELETE(request: Request) {
	const guard = await requireViewer({ permission: "manageLocationAccess" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const payload = (await request.json()) as Payload
	const branchId = payload.branchId
	const memberId = payload.memberId

	if (!branchId || !memberId) {
		return jsonError("branchId and memberId are required.", 400)
	}

	const deleted = await db
		.delete(memberBranchAccess)
		.where(
			and(
				eq(memberBranchAccess.organizationId, viewer.activeOrganizationId),
				eq(memberBranchAccess.branchId, branchId),
				eq(memberBranchAccess.memberId, memberId),
			),
		)
		.returning({ id: memberBranchAccess.id })

	if (deleted.length === 0) {
		return jsonError("Access mapping not found.", 404)
	}

	return NextResponse.json({ success: true })
}
