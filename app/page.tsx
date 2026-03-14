import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { routes } from "@/config/routes"
import { auth } from "@/lib/auth"
import { signUpOnboardingGateCookieName } from "@/lib/auth-flow"
import { resolveAuthContext } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Rental Ops",
}

export default async function Page() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session) {
		redirect(routes.auth.signIn)
	}

	const cookieStore = await cookies()
	const hasSignUpOnboardingGate = Boolean(
		cookieStore.get(signUpOnboardingGateCookieName)?.value,
	)

	if (!hasSignUpOnboardingGate) {
		const resolved = await resolveAuthContext()

		redirect(resolved?.appState === "ready" ? routes.app.root : routes.setup)
	}

	redirect(
		hasSignUpOnboardingGate ? routes.auth.signUpOnboarding : routes.app.root,
	)
}
