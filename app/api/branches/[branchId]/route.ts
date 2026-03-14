import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"

type RouteProps = {
	params: Promise<{
		branchId: string
	}>
}

export async function PATCH(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "manageBranches" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const { branchId } = await params
	const payload = (await request.json()) as {
		name?: string
		code?: string
		address?: string
		isActive?: boolean
	}

	const updates: Partial<typeof branch.$inferInsert> = {}

	if (typeof payload.name === "string") {
		updates.name = payload.name.trim()
	}

	if (typeof payload.code === "string") {
		updates.code = payload.code.trim().toUpperCase()
	}

	if (typeof payload.address === "string") {
		updates.address = payload.address.trim() || null
	}

	if (typeof payload.isActive === "boolean") {
		updates.isActive = payload.isActive
	}

	updates.updatedAt = new Date()

	if (
		!updates.name &&
		!updates.code &&
		payload.address === undefined &&
		payload.isActive === undefined
	) {
		return jsonError("No updates provided.", 400)
	}

	try {
		const updated = await db
			.update(branch)
			.set(updates)
			.where(
				and(
					eq(branch.id, branchId),
					eq(branch.organizationId, viewer.activeOrganizationId),
				),
			)
			.returning({ id: branch.id })

		if (updated.length === 0) {
			return jsonError("Branch not found.", 404)
		}

		return NextResponse.json({ success: true })
	} catch {
		return jsonError("Unable to update branch.", 400)
	}
}

export async function DELETE(_request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "manageBranches" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const { branchId } = await params

	const deleted = await db
		.delete(branch)
		.where(
			and(
				eq(branch.id, branchId),
				eq(branch.organizationId, viewer.activeOrganizationId),
			),
		)
		.returning({ id: branch.id })

	if (deleted.length === 0) {
		return jsonError("Branch not found.", 404)
	}

	return NextResponse.json({ success: true })
}
