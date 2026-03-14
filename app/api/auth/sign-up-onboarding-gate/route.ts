import { NextResponse } from "next/server"

import {
	signUpOnboardingGateCookieName,
	signUpOnboardingGateMaxAgeSeconds,
} from "@/lib/auth-flow"
import { resolveAuthContext } from "@/lib/authorization/server"

export async function POST() {
	const resolved = await resolveAuthContext()

	if (!resolved) {
		return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
	}

	if (
		resolved.activeOrganization ||
		resolved.accessibleOrganizations.length > 0
	) {
		return NextResponse.json(
			{
				error:
					"Sign-up onboarding is only available before joining an organization.",
			},
			{ status: 409 },
		)
	}

	const response = NextResponse.json({ success: true })
	response.cookies.set(signUpOnboardingGateCookieName, "1", {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: signUpOnboardingGateMaxAgeSeconds,
	})

	return response
}

export async function DELETE() {
	const response = NextResponse.json({ success: true })
	response.cookies.set(signUpOnboardingGateCookieName, "", {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: 0,
	})
	return response
}
