import type { Permission } from "@/lib/authorization/policies"
import type { Context } from "@/types"

export type AuthContextResponse = {
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
	accessibleOrganizations: Array<{
		id: string
		name: string
		slug: string
		logo: string | null
		isVisible: boolean
		metadata: {
			logoBlurDataUrl?: string | null
			supportEmail?: string | null
			supportPhone?: string | null
			website?: string | null
		} | null
		role: string
	}>
	activeOrganization: {
		id: string
		name: string
		slug: string
		logo: string | null
		metadata: {
			logoBlurDataUrl?: string | null
			supportEmail?: string | null
			supportPhone?: string | null
			website?: string | null
		} | null
		isVisible: boolean
		role: string
	} | null
	appState: "ready" | "needs_onboarding"
	capabilities: {
		hasActiveOrganization: boolean
		canManageOrganization: boolean
		canDeleteOrganization: boolean
		canManageVisibility: boolean
	}
	permissions: Record<Permission, boolean>
}
