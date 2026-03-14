import { passkeyClient } from "@better-auth/passkey/client"
import {
	adminClient,
	inferOrgAdditionalFields,
	organizationClient,
	twoFactorClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { routes } from "@/config/routes"
import type { auth } from "./auth"
import {
	organizationAccessControl,
	organizationRoles,
} from "./authorization/policies"

export const authClient = createAuthClient({
	plugins: [
		organizationClient({
			schema: inferOrgAdditionalFields<typeof auth>(),
			ac: organizationAccessControl,
			roles: organizationRoles,
			dynamicAccessControl: {
				enabled: true,
			},
		}),
		adminClient(),
		passkeyClient(),
		twoFactorClient({
			onTwoFactorRedirect() {
				if (typeof window !== "undefined") {
					window.location.href = routes.auth.twoFactor
				}
			},
		}),
	],
})
