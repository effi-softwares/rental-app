import { and, asc, eq, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { member, organization, session, user } from "@/lib/db/schema/auth"

type ReconcileActiveOrganizationInput = {
	userId: string
	userActiveOrganizationId: string | null
	sessionActiveOrganizationId: string | null
	accessibleOrganizationIds: string[]
}

type ActiveOrganizationWriter = Pick<typeof db, "update">

export async function getUserActiveOrganizationId(userId: string) {
	const rows = await db
		.select({
			activeOrganizationId: user.activeOrganizationId,
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1)

	return rows[0]?.activeOrganizationId ?? null
}

export async function getAccessibleOrganizationIdsForUser(userId: string) {
	const rows = await db
		.select({
			id: organization.id,
		})
		.from(member)
		.innerJoin(organization, eq(organization.id, member.organizationId))
		.where(
			and(
				eq(member.userId, userId),
				or(
					eq(organization.isVisible, true),
					sql`${member.role} like '%owner%'`,
					sql`${member.role} like '%admin%'`,
				),
			),
		)
		.orderBy(asc(organization.name))

	return rows.map((row) => row.id)
}

export function resolveCanonicalActiveOrganizationId({
	userActiveOrganizationId,
	sessionActiveOrganizationId,
	accessibleOrganizationIds,
}: Omit<ReconcileActiveOrganizationInput, "userId">) {
	const accessibleOrganizationIdSet = new Set(accessibleOrganizationIds)

	if (
		userActiveOrganizationId &&
		accessibleOrganizationIdSet.has(userActiveOrganizationId)
	) {
		return userActiveOrganizationId
	}

	if (
		sessionActiveOrganizationId &&
		accessibleOrganizationIdSet.has(sessionActiveOrganizationId)
	) {
		return sessionActiveOrganizationId
	}

	return accessibleOrganizationIds[0] ?? null
}

async function writeCanonicalActiveOrganization(
	writer: ActiveOrganizationWriter,
	userId: string,
	organizationId: string | null,
) {
	await writer
		.update(user)
		.set({
			activeOrganizationId: organizationId,
		})
		.where(eq(user.id, userId))

	await writer
		.update(session)
		.set({
			activeOrganizationId: organizationId,
		})
		.where(eq(session.userId, userId))
}

export async function syncCanonicalActiveOrganizationForUser(
	userId: string,
	organizationId: string | null,
) {
	await db.transaction(async (tx) => {
		await writeCanonicalActiveOrganization(tx, userId, organizationId)
	})
}

export async function reconcileCanonicalActiveOrganizationForUser({
	userId,
	userActiveOrganizationId,
	sessionActiveOrganizationId,
	accessibleOrganizationIds,
}: ReconcileActiveOrganizationInput) {
	const activeOrganizationId = resolveCanonicalActiveOrganizationId({
		userActiveOrganizationId,
		sessionActiveOrganizationId,
		accessibleOrganizationIds,
	})
	const didChange =
		userActiveOrganizationId !== activeOrganizationId ||
		sessionActiveOrganizationId !== activeOrganizationId

	if (didChange) {
		await db.transaction(async (tx) => {
			await writeCanonicalActiveOrganization(tx, userId, activeOrganizationId)
		})
	}

	return {
		activeOrganizationId,
		didChange,
	}
}
