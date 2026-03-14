import type { Permission } from "@/lib/authorization/policies"
import { getContext, viewerHasPermission } from "@/lib/authorization/server"
import type { Context } from "@/types"
import { forbiddenError, unauthorizedError } from "./errors"

type ContextWithActiveOrganization = Context & {
	activeOrganizationId: string
}

type ViewerGuardOptions = {
	requireActiveOrganization?: boolean
	permission?: Permission
}

type ViewerGuardResult =
	| { viewer: Context; response?: never }
	| { viewer?: never; response: Response }

type ViewerGuardWithActiveOrganizationResult =
	| { viewer: ContextWithActiveOrganization; response?: never }
	| { viewer?: never; response: Response }

export async function requireViewer(
	options?: ViewerGuardOptions & { requireActiveOrganization?: true },
): Promise<ViewerGuardWithActiveOrganizationResult>

export async function requireViewer(
	options: ViewerGuardOptions & { requireActiveOrganization: false },
): Promise<ViewerGuardResult>

export async function requireViewer(
	options: ViewerGuardOptions = {},
): Promise<ViewerGuardResult | ViewerGuardWithActiveOrganizationResult> {
	const { requireActiveOrganization = true, permission } = options

	const viewer = await getContext()

	if (!viewer) {
		return { response: unauthorizedError() }
	}

	if (requireActiveOrganization && !viewer.activeOrganizationId) {
		return { response: unauthorizedError() }
	}

	if (permission && !(await viewerHasPermission(viewer, permission))) {
		return { response: forbiddenError() }
	}

	if (requireActiveOrganization) {
		return {
			viewer: viewer as ContextWithActiveOrganization,
		}
	}

	return { viewer }
}
