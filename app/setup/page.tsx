import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"
import { routes } from "@/config/routes"
import { resolveAuthContext } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Workspace Setup",
}

export default async function SetupPage() {
	const resolved = await resolveAuthContext()

	if (!resolved) {
		redirect(routes.auth.signIn)
	}

	if (resolved.appState === "ready") {
		redirect(routes.app.root)
	}

	return (
		<AuthPageShell
			title="Set up your workspace"
			description="Create your first organization to start using the app."
		>
			<OnboardingForm
				userName={resolved.user?.name ?? "Owner"}
				flow="app-setup"
			/>
		</AuthPageShell>
	)
}
