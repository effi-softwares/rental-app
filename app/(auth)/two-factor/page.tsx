import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { AuthPanel } from "@/components/auth/auth-panel"
import { TwoFactorChallengeForm } from "@/components/auth/two-factor-challenge-form"
import { routes } from "@/config/routes"
import { auth } from "@/lib/auth"
import { signUpOnboardingGateCookieName } from "@/lib/auth-flow"

export const metadata: Metadata = {
	title: "Two-factor Verification",
}

export default async function TwoFactorPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (session) {
		const cookieStore = await cookies()
		const hasSignUpOnboardingGate = Boolean(
			cookieStore.get(signUpOnboardingGateCookieName)?.value,
		)

		redirect(
			hasSignUpOnboardingGate ? routes.auth.signUpOnboarding : routes.app.root,
		)
	}

	return (
		<AuthPageShell
			eyebrow="Two-factor check"
			title="Verify your sign-in"
			description="Use your authentication method to continue securely into the dashboard."
			visualVariant="two-factor"
			contentWidth="md"
		>
			<Suspense
				fallback={
					<AuthPanel className="text-sm text-muted-foreground">
						Loading verification...
					</AuthPanel>
				}
			>
				<TwoFactorChallengeForm />
			</Suspense>
		</AuthPageShell>
	)
}
