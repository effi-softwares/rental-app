"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Fingerprint, KeyRound } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { type FormEvent, useState } from "react"

import { AuthInlineMessage, AuthPanel } from "@/components/auth/auth-panel"
import { Button } from "@/components/ui/button"
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { routes } from "@/config/routes"
import { mainQueryKeys } from "@/features/main/queries/keys"
import { authClient } from "@/lib/auth-client"

export function SignInForm() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const queryClient = useQueryClient()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const redirectTo = (() => {
		const nextPath = searchParams.get("redirectTo")
		return nextPath?.startsWith("/") ? nextPath : routes.app.root
	})()

	async function completePostSignInRouting() {
		await queryClient.invalidateQueries({ queryKey: mainQueryKeys.all })
		router.replace(redirectTo)
		router.refresh()
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError(null)
		setIsSubmitting(true)

		const formData = new FormData(event.currentTarget)
		const email = String(formData.get("email") ?? "")
		const password = String(formData.get("password") ?? "")

		const { data, error: signInError } = await authClient.signIn.email({
			email,
			password,
			callbackURL: redirectTo,
			rememberMe: true,
		})

		setIsSubmitting(false)

		if (signInError) {
			setError(signInError.message ?? "Unable to sign in. Please try again.")
			return
		}

		if (
			data &&
			typeof data === "object" &&
			"twoFactorRedirect" in data &&
			Boolean(data.twoFactorRedirect)
		) {
			router.replace(
				`${routes.auth.twoFactor}?redirectTo=${encodeURIComponent(redirectTo)}`,
			)
			router.refresh()
			return
		}

		await completePostSignInRouting()
	}

	async function onPasskeySignIn() {
		setError(null)
		setIsPasskeySubmitting(true)

		const { data, error: passkeyError } = await authClient.signIn.passkey()

		setIsPasskeySubmitting(false)

		if (passkeyError) {
			setError(passkeyError.message ?? "Unable to sign in with passkey.")
			return
		}

		if (
			data &&
			typeof data === "object" &&
			"twoFactorRedirect" in data &&
			Boolean(data.twoFactorRedirect)
		) {
			router.replace(
				`${routes.auth.twoFactor}?redirectTo=${encodeURIComponent(redirectTo)}`,
			)
			router.refresh()
			return
		}

		await completePostSignInRouting()
	}

	return (
		<AuthPanel className="space-y-6">
			<form onSubmit={onSubmit}>
				<FieldGroup className="gap-4">
					<Field>
						<FieldLabel htmlFor="email">Email</FieldLabel>
						<Input
							id="email"
							name="email"
							type="email"
							autoComplete="email webauthn"
							required
							className="h-12 rounded-xl"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="password">Password</FieldLabel>
						<Input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password webauthn"
							required
							className="h-12 rounded-xl"
						/>
					</Field>

					{error ? (
						<AuthInlineMessage variant="destructive">{error}</AuthInlineMessage>
					) : null}

					<Button
						type="submit"
						size="lg"
						className="h-12 w-full rounded-xl"
						disabled={isSubmitting || isPasskeySubmitting}
					>
						<KeyRound className="size-4" />
						{isSubmitting ? "Signing in..." : "Continue with password"}
					</Button>

					<FieldSeparator>or</FieldSeparator>

					<Button
						type="button"
						variant="outline"
						size="lg"
						className="h-12 w-full rounded-xl"
						onClick={() => void onPasskeySignIn()}
						disabled={isSubmitting || isPasskeySubmitting}
					>
						<Fingerprint className="size-4" />
						{isPasskeySubmitting ? "Signing in..." : "Continue with passkey"}
					</Button>

					<p className="text-center text-sm text-muted-foreground">
						New owner?{" "}
						<Link
							href={routes.auth.signUp}
							className="font-medium text-foreground underline underline-offset-4"
						>
							Create account
						</Link>
					</p>
				</FieldGroup>
			</form>
		</AuthPanel>
	)
}
