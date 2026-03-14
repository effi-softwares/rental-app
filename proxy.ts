import { getSessionCookie } from "better-auth/cookies"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { routes } from "@/config/routes"
import { signUpOnboardingGateCookieName } from "@/lib/auth-flow"

const guestOnlyAuthRoutes = new Set([
	routes.auth.signIn,
	routes.auth.signUp,
	routes.auth.twoFactor,
])

function isAppRoute(pathname: string) {
	return (
		pathname === routes.app.root || pathname.startsWith(`${routes.app.root}/`)
	)
}

function isInvitationRoute(pathname: string) {
	return pathname.startsWith("/invitation/")
}

function isGuestOnlyAuthRoute(pathname: string) {
	return guestOnlyAuthRoutes.has(pathname)
}

function isSignUpOnboardingRoute(pathname: string) {
	return pathname === routes.auth.signUpOnboarding
}

function isUnrestrictedFrontendRoute(pathname: string) {
	return pathname === routes.home || isInvitationRoute(pathname)
}

function buildRedirectUrl(request: NextRequest, pathname: string) {
	const redirectUrl = request.nextUrl.clone()
	redirectUrl.pathname = pathname
	redirectUrl.search = ""

	if (isAppRoute(request.nextUrl.pathname)) {
		redirectUrl.searchParams.set(
			"redirectTo",
			`${request.nextUrl.pathname}${request.nextUrl.search}`,
		)
	}

	return redirectUrl
}

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl
	const hasSignUpOnboardingGate = Boolean(
		request.cookies.get(signUpOnboardingGateCookieName)?.value,
	)
	const hasSessionCookie = Boolean(getSessionCookie(request))

	if (
		isUnrestrictedFrontendRoute(pathname) ||
		(!isAppRoute(pathname) &&
			!isGuestOnlyAuthRoute(pathname) &&
			!isSignUpOnboardingRoute(pathname))
	) {
		return NextResponse.next()
	}

	if (!hasSessionCookie) {
		if (isGuestOnlyAuthRoute(pathname)) {
			return NextResponse.next()
		}

		return NextResponse.redirect(buildRedirectUrl(request, routes.auth.signIn))
	}

	if (isGuestOnlyAuthRoute(pathname)) {
		return NextResponse.next()
	}

	if (isSignUpOnboardingRoute(pathname) && !hasSignUpOnboardingGate) {
		return NextResponse.redirect(buildRedirectUrl(request, routes.app.root))
	}

	return NextResponse.next()
}

export const config = {
	matcher: [
		"/",
		"/app/:path*",
		"/sign-in",
		"/sign-up",
		"/sign-up/onboarding",
		"/two-factor",
		"/invitation/:path*",
	],
}
