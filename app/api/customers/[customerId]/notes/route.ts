import { and, asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { forbiddenError, jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import {
	getScopedBranchIdsForViewer,
	getViewerMembershipId,
	viewerHasPermission,
} from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { member, user } from "@/lib/db/schema/auth"
import { customer, customerNote } from "@/lib/db/schema/customers"

type RouteProps = {
	params: Promise<{
		customerId: string
	}>
}

async function ensureCustomerVisible(customerId: string) {
	const guard = await requireViewer({ permission: "viewCustomerModule" })

	if (guard.response) {
		return {
			error: guard.response,
			viewer: null,
			organizationId: null,
		}
	}

	const viewer = guard.viewer

	const organizationId = viewer.activeOrganizationId
	const targetCustomerRows = await db
		.select({
			id: customer.id,
			branchId: customer.branchId,
		})
		.from(customer)
		.where(
			and(
				eq(customer.id, customerId),
				eq(customer.organizationId, organizationId),
			),
		)
		.limit(1)

	const targetCustomer = targetCustomerRows[0]
	if (!targetCustomer) {
		return {
			error: jsonError("Customer not found.", 404),
			viewer: null,
			organizationId: null,
		}
	}

	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)
	if (scopedBranchIds !== null) {
		if (
			!targetCustomer.branchId ||
			!scopedBranchIds.includes(targetCustomer.branchId)
		) {
			return {
				error: forbiddenError(),
				viewer: null,
				organizationId: null,
			}
		}
	}

	return {
		error: null,
		viewer,
		organizationId,
	}
}

export async function GET(_request: Request, { params }: RouteProps) {
	const { customerId } = await params
	const visible = await ensureCustomerVisible(customerId)

	if (visible.error) {
		return visible.error
	}

	const notes = await db
		.select({
			id: customerNote.id,
			body: customerNote.body,
			createdAt: customerNote.createdAt,
			authorName: user.name,
			authorEmail: user.email,
		})
		.from(customerNote)
		.innerJoin(member, eq(member.id, customerNote.authorMemberId))
		.innerJoin(user, eq(user.id, member.userId))
		.where(
			and(
				eq(customerNote.organizationId, visible.organizationId),
				eq(customerNote.customerId, customerId),
			),
		)
		.orderBy(asc(customerNote.createdAt))

	return NextResponse.json({
		notes: notes.map((note) => ({
			id: note.id,
			body: note.body,
			createdAt: note.createdAt.toISOString(),
			authorName: note.authorName,
			authorEmail: note.authorEmail,
		})),
	})
}

export async function POST(request: Request, { params }: RouteProps) {
	const { customerId } = await params
	const visible = await ensureCustomerVisible(customerId)

	if (visible.error) {
		return visible.error
	}

	if (!(await viewerHasPermission(visible.viewer, "manageCustomerNotes"))) {
		return forbiddenError()
	}

	const membershipId = await getViewerMembershipId(visible.viewer)
	if (!membershipId) {
		return jsonError("Membership not found.", 404)
	}

	const payload = (await request.json()) as {
		body?: string
	}

	const body = payload.body?.trim()
	if (!body) {
		return jsonError("Note body is required.", 400)
	}

	await db.insert(customerNote).values({
		organizationId: visible.organizationId,
		customerId,
		authorMemberId: membershipId,
		body,
	})

	return NextResponse.json({ success: true }, { status: 201 })
}
