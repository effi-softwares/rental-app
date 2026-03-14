import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"
import { routes } from "@/config/routes"
import { resolveAuthContext } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Sign-up Onboarding",
}

export default async function SignUpOnboardingPage() {
	const resolved = await resolveAuthContext()

	if (!resolved) {
		redirect(routes.auth.signIn)
	}

	if (
		resolved.activeOrganization ||
		resolved.accessibleOrganizations.length > 0
	) {
		redirect(routes.app.root)
	}

	return (
		<AuthPageShell
			title="Set up your organization"
			description="Create your first organization to finish the owner sign-up flow."
		>
			<OnboardingForm
				userName={resolved.user?.name ?? "Owner"}
				flow="sign-up"
			/>
		</AuthPageShell>
	)
}
