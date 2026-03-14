import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { db } from "@/lib/db"
import { invitation, organization, user } from "@/lib/db/schema/auth"

type RouteProps = {
	params: Promise<{
		invitationId: string
	}>
}

function resolveInvitationState(status: string, expiresAt: Date) {
	if (status !== "pending") {
		return status
	}

	if (expiresAt < new Date()) {
		return "expired"
	}

	return "pending"
}

export async function GET(_: Request, { params }: RouteProps) {
	const { invitationId } = await params

	const invitationRows = await db
		.select({
			id: invitation.id,
			email: invitation.email,
			role: invitation.role,
			status: invitation.status,
			expiresAt: invitation.expiresAt,
			organizationId: organization.id,
			organizationName: organization.name,
			organizationSlug: organization.slug,
			organizationLogo: organization.logo,
		})
		.from(invitation)
		.innerJoin(organization, eq(organization.id, invitation.organizationId))
		.where(eq(invitation.id, invitationId))
		.limit(1)

	const invitationRecord = invitationRows[0]

	if (!invitationRecord) {
		return jsonError("Invitation not found.", 404)
	}

	const existingUsers = await db
		.select({
			id: user.id,
		})
		.from(user)
		.where(eq(user.email, invitationRecord.email))
		.limit(1)

	return NextResponse.json({
		id: invitationRecord.id,
		email: invitationRecord.email,
		role: invitationRecord.role,
		status: invitationRecord.status,
		invitationState: resolveInvitationState(
			invitationRecord.status,
			invitationRecord.expiresAt,
		),
		expiresAt: invitationRecord.expiresAt,
		accountExists: Boolean(existingUsers[0]),
		organization: {
			id: invitationRecord.organizationId,
			name: invitationRecord.organizationName,
			slug: invitationRecord.organizationSlug,
			logo: invitationRecord.organizationLogo,
		},
	})
}
