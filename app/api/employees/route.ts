import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { member, user } from "@/lib/db/schema/auth"

type CreateEmployeePayload = {
	email?: string
	role?: string
}

const MEMBER_ROLES = ["member", "admin", "owner"] as const
type MemberRole = (typeof MEMBER_ROLES)[number]

function isMemberRole(value: string): value is MemberRole {
	return MEMBER_ROLES.includes(value as MemberRole)
}

export async function POST(request: Request) {
	const viewerResult = await requireViewer({ permission: "inviteEmployees" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const payload = (await request.json()) as CreateEmployeePayload
	const email = payload.email?.trim().toLowerCase()
	const requestedRole = payload.role?.trim().toLowerCase()
	let role: MemberRole = "member"
	if (requestedRole) {
		if (!isMemberRole(requestedRole)) {
			return jsonError("Invalid employee role.", 400)
		}
		role = requestedRole
	}

	if (!email) {
		return jsonError("Employee email is required.", 400)
	}

	if (!email.includes("@")) {
		return jsonError("A valid employee email is required.", 400)
	}

	const organizationId = viewer.activeOrganizationId

	const existingUsers = await db
		.select({
			id: user.id,
		})
		.from(user)
		.where(eq(user.email, email))
		.limit(1)

	if (existingUsers[0]) {
		const existingMembership = await db
			.select({ id: member.id })
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, existingUsers[0].id),
				),
			)
			.limit(1)

		if (existingMembership[0]) {
			return jsonError(
				"This user is already a member of the active organization.",
				409,
			)
		}
	}

	try {
		await auth.api.createInvitation({
			headers: await headers(),
			body: {
				email,
				role,
				organizationId,
				resend: true,
			},
		})

		return NextResponse.json(
			{
				success: true,
				message: "Invitation sent.",
			},
			{ status: 201 },
		)
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to send invitation."

		return jsonError(message, 400)
	}
}
