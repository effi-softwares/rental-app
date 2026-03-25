import { and, asc, eq, or, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { routes } from "@/config/routes"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { member, organization, user } from "@/lib/db/schema/auth"
import { memberBranchAccess } from "@/lib/db/schema/branches"
import type { Context } from "@/types"
import {
	getUserActiveOrganizationId,
	reconcileCanonicalActiveOrganizationForUser,
} from "./active-organization"
import { buildForbiddenHref, type ForbiddenReason } from "./forbidden"
import {
	normalizeOrganizationRole,
	type Permission,
	permissionRequirements,
} from "./policies"

type SessionPayload = {
	user?: {
		id?: string | null
		name?: string | null
		email?: string | null
		emailVerified?: boolean
		twoFactorEnabled?: boolean
		role?: string | null
	}
	session?: {
		activeOrganizationId?: string | null
	}
}

type OrganizationMetadata = {
	logoBlurDataUrl?: string | null
	supportEmail?: string | null
	supportPhone?: string | null
	website?: string | null
}

type AccessibleOrganization = {
	id: string
	name: string
	slug: string
	logo: string | null
	isVisible: boolean
	metadata: OrganizationMetadata | null
	role: string
}

export type ResolvedAuthContext = {
	session: {
		hasSession: boolean
		activeOrganizationId: string | null
	}
	user: {
		id: string | null
		name: string | null
		email: string | null
		emailVerified: boolean
		twoFactorEnabled: boolean
		role: string | null
		preferences: {
			hapticsEnabled: boolean
		}
	} | null
	viewer: Context
	accessibleOrganizations: AccessibleOrganization[]
	activeOrganization: AccessibleOrganization | null
	appState: "ready" | "needs_onboarding"
	capabilities: {
		hasActiveOrganization: boolean
		canManageOrganization: boolean
		canDeleteOrganization: boolean
		canManageVisibility: boolean
	}
	permissions: Record<Permission, boolean>
}

function parseOrganizationMetadata(
	value: string | null,
): OrganizationMetadata | null {
	if (!value) {
		return null
	}

	try {
		const parsed = JSON.parse(value) as Record<string, unknown>
		return {
			logoBlurDataUrl:
				typeof parsed.logoBlurDataUrl === "string"
					? parsed.logoBlurDataUrl
					: null,
			supportEmail:
				typeof parsed.supportEmail === "string" ? parsed.supportEmail : null,
			supportPhone:
				typeof parsed.supportPhone === "string" ? parsed.supportPhone : null,
			website: typeof parsed.website === "string" ? parsed.website : null,
		}
	} catch {
		return null
	}
}

export async function getAccessibleOrganizationsForUser(userId: string) {
	const organizationRows = await db
		.select({
			id: organization.id,
			name: organization.name,
			slug: organization.slug,
			logo: organization.logo,
			metadata: organization.metadata,
			isVisible: organization.isVisible,
			role: member.role,
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

	return organizationRows.map((row) => ({
		id: row.id,
		name: row.name,
		slug: row.slug,
		logo: row.logo,
		metadata: parseOrganizationMetadata(row.metadata),
		isVisible: row.isVisible ?? true,
		role: normalizeOrganizationRole(row.role),
	}))
}

export async function resolveAuthContext(): Promise<ResolvedAuthContext | null> {
	const currentSession = (await auth.api.getSession({
		headers: await headers(),
	})) as SessionPayload | null

	const userId = currentSession?.user?.id
	if (!userId) {
		return null
	}

	const [accessibleOrganizations, userActiveOrganizationId, currentUser] =
		await Promise.all([
			getAccessibleOrganizationsForUser(userId),
			getUserActiveOrganizationId(userId),
			db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					twoFactorEnabled: user.twoFactorEnabled,
					role: user.role,
					hapticsEnabled: user.hapticsEnabled,
				})
				.from(user)
				.where(eq(user.id, userId))
				.limit(1)
				.then((rows) => rows[0] ?? null),
		])
	if (!currentUser) {
		return null
	}
	const sessionActiveOrganizationId =
		currentSession?.session?.activeOrganizationId ?? null
	const reconciled = await reconcileCanonicalActiveOrganizationForUser({
		userId,
		userActiveOrganizationId,
		sessionActiveOrganizationId,
		accessibleOrganizationIds: accessibleOrganizations.map(
			(organizationRecord) => organizationRecord.id,
		),
	})
	const activeOrganization =
		accessibleOrganizations.find(
			(organizationRecord) =>
				organizationRecord.id === reconciled.activeOrganizationId,
		) ?? null

	const viewerRole = activeOrganization?.role ?? "member"
	const viewer: Context = {
		userId,
		activeOrganizationId: activeOrganization?.id ?? null,
		role: viewerRole,
	}

	const permissionKeys = activeOrganization
		? (Object.keys(permissionRequirements) as Permission[])
		: []
	const permissionEntries = await Promise.all(
		permissionKeys.map(async (permission) => {
			const isAllowed = await viewerHasPermission(viewer, permission)
			return [permission, isAllowed] as const
		}),
	)

	const canManageOrganization = viewerRole === "owner" || viewerRole === "admin"
	const canDeleteOrganization = viewerRole === "owner"
	const canManageVisibility = viewerRole === "owner"

	return {
		session: {
			hasSession: true,
			activeOrganizationId: reconciled.activeOrganizationId,
		},
		user: {
			id: currentUser.id,
			name: currentUser.name,
			email: currentUser.email,
			emailVerified: currentUser.emailVerified,
			twoFactorEnabled: currentUser.twoFactorEnabled ?? false,
			role: currentUser.role,
			preferences: {
				hapticsEnabled: currentUser.hapticsEnabled ?? true,
			},
		},
		viewer,
		accessibleOrganizations,
		activeOrganization,
		appState: activeOrganization ? "ready" : "needs_onboarding",
		capabilities: {
			hasActiveOrganization: Boolean(activeOrganization),
			canManageOrganization:
				Boolean(activeOrganization) && canManageOrganization,
			canDeleteOrganization:
				Boolean(activeOrganization) && canDeleteOrganization,
			canManageVisibility: Boolean(activeOrganization) && canManageVisibility,
		},
		permissions: Object.fromEntries(permissionEntries) as Record<
			Permission,
			boolean
		>,
	}
}

export async function getViewerMembershipId(
	viewer: Context,
): Promise<string | null> {
	if (!viewer.activeOrganizationId) {
		return null
	}

	const currentMembership = await db
		.select({
			id: member.id,
		})
		.from(member)
		.where(
			and(
				eq(member.organizationId, viewer.activeOrganizationId),
				eq(member.userId, viewer.userId),
			),
		)
		.limit(1)

	return currentMembership[0]?.id ?? null
}

export async function getScopedBranchIdsForViewer(
	viewer: Context,
): Promise<string[] | null> {
	if (!viewer.activeOrganizationId) {
		return []
	}

	const [canManageLocationAccess, canManageBranches] = await Promise.all([
		viewerHasPermission(viewer, "manageLocationAccess"),
		viewerHasPermission(viewer, "manageBranches"),
	])

	if (canManageLocationAccess || canManageBranches) {
		return null
	}

	const membershipId = await getViewerMembershipId(viewer)
	if (!membershipId) {
		return []
	}

	const accessRows = await db
		.select({
			branchId: memberBranchAccess.branchId,
		})
		.from(memberBranchAccess)
		.where(
			and(
				eq(memberBranchAccess.organizationId, viewer.activeOrganizationId),
				eq(memberBranchAccess.memberId, membershipId),
			),
		)

	return accessRows.map((row) => row.branchId)
}

export async function getContext(): Promise<Context | null> {
	const resolved = await resolveAuthContext()
	return resolved?.viewer ?? null
}

export async function viewerHasPermission(
	viewer: Context,
	permission: Permission,
): Promise<boolean> {
	if (!viewer.activeOrganizationId) {
		return false
	}

	const result = await auth.api.hasPermission({
		headers: await headers(),
		body: {
			organizationId: viewer.activeOrganizationId,
			permissions: permissionRequirements[permission],
		},
	})

	return result.success
}

export async function requireWorkspaceContext(): Promise<ResolvedAuthContext> {
	const resolved = await resolveAuthContext()

	if (!resolved) {
		redirect(routes.auth.signIn)
	}

	if (resolved.appState !== "ready" || !resolved.viewer.activeOrganizationId) {
		redirect(routes.setup)
	}

	return resolved
}

type RequireWorkspacePermissionOptions = {
	permission: Permission
	reason: ForbiddenReason
}

export async function requireWorkspacePermission({
	permission,
	reason,
}: RequireWorkspacePermissionOptions): Promise<ResolvedAuthContext> {
	const resolved = await requireWorkspaceContext()

	if (!resolved.permissions[permission]) {
		redirect(buildForbiddenHref(reason))
	}

	return resolved
}

export function isPrivilegedFleetViewerRole(role?: string | null) {
	return role === "owner" || role === "admin"
}

export async function requirePrivilegedFleetAccess(
	reason: ForbiddenReason = "fleetLive",
) {
	const resolved = await requireWorkspacePermission({
		permission: "viewFleetModule",
		reason,
	})

	if (!isPrivilegedFleetViewerRole(resolved.viewer.role)) {
		redirect(buildForbiddenHref(reason))
	}

	return resolved
}
