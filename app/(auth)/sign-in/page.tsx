import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { AuthPanel } from "@/components/auth/auth-panel"
import { SignInForm } from "@/components/auth/sign-in-form"
import { isPlatformSignupEnabled } from "@/config/feature-flags"
import { routes } from "@/config/routes"
import { auth } from "@/lib/auth"
import { signUpOnboardingGateCookieName } from "@/lib/auth-flow"

export const metadata: Metadata = {
	title: "Sign In",
}

export default async function SignInPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (session) {
		const cookieStore = await cookies()
		const hasSignUpOnboardingGate =
			isPlatformSignupEnabled &&
			Boolean(cookieStore.get(signUpOnboardingGateCookieName)?.value)

		redirect(
			hasSignUpOnboardingGate ? routes.auth.signUpOnboarding : routes.app.root,
		)
	}

	return (
		<AuthPageShell
			title="Welcome back"
			description="Sign in to manage rentals, teams, customers, and gallery operations."
			visualVariant="sign-in"
			contentWidth="sm"
		>
			<Suspense
				fallback={
					<AuthPanel className="text-sm text-muted-foreground">
						Loading sign-in...
					</AuthPanel>
				}
			>
				<SignInForm />
			</Suspense>
		</AuthPageShell>
	)
}
