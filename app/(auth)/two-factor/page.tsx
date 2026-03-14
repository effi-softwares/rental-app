import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
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
			title="Verify your sign-in"
			description="Use your authentication method to continue securely into the dashboard."
		>
			<Suspense
				fallback={
					<div className="w-full max-w-lg rounded-lg border border-border/70 bg-card p-6 text-sm text-muted-foreground">
						Loading verification...
					</div>
				}
			>
				<TwoFactorChallengeForm />
			</Suspense>
		</AuthPageShell>
	)
}
