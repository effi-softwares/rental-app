import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { normalizeOrganizationRole } from "@/lib/authorization/policies"
import { db } from "@/lib/db"
import { member, organization } from "@/lib/db/schema/auth"

type OrganizationMetadata = {
	logoBlurDataUrl?: string | null
	supportEmail?: string | null
	supportPhone?: string | null
	website?: string | null
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

export async function GET() {
	const guard = await requireViewer({
		permission: "manageOrganizationSettings",
	})

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer

	const rows = await db
		.select({
			id: organization.id,
			name: organization.name,
			slug: organization.slug,
			logo: organization.logo,
			metadata: organization.metadata,
			isVisible: organization.isVisible,
			role: member.role,
		})
		.from(organization)
		.innerJoin(
			member,
			and(
				eq(member.organizationId, organization.id),
				eq(member.userId, viewer.userId),
			),
		)
		.where(eq(organization.id, viewer.activeOrganizationId))
		.limit(1)

	const currentOrganization = rows[0]
	if (!currentOrganization) {
		return jsonError("Organization not found.", 404)
	}

	const role = normalizeOrganizationRole(currentOrganization.role)
	const canManageOrganization = role === "owner" || role === "admin"
	const canDeleteOrganization = role === "owner"
	const canManageVisibility = role === "owner"

	return NextResponse.json({
		organization: {
			id: currentOrganization.id,
			name: currentOrganization.name,
			slug: currentOrganization.slug,
			logo: currentOrganization.logo,
			metadata: parseOrganizationMetadata(currentOrganization.metadata),
			isVisible: currentOrganization.isVisible,
		},
		role,
		canManageOrganization,
		canDeleteOrganization,
		canManageVisibility,
	})
}
