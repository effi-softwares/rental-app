import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { SignUpForm } from "@/components/auth/sign-up-form"
import { routes } from "@/config/routes"
import { auth } from "@/lib/auth"
import { signUpOnboardingGateCookieName } from "@/lib/auth-flow"

export const metadata: Metadata = {
	title: "Create Account",
}

export default async function SignUpPage() {
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
			title="Create your workspace account"
			description="Set up your owner account and start configuring your rental operations dashboard."
		>
			<SignUpForm />
		</AuthPageShell>
	)
}
