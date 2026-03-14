"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { type FormEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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
		<Card className="w-full max-w-md border-border/70">
			<CardHeader>
				<div className="mb-1 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary/10 px-4 text-primary text-sm font-medium">
					<ShieldCheck className="size-4" />
					Secure access
				</div>
				<CardTitle className="text-xl">Sign in</CardTitle>
				<CardDescription>
					Access your rental operations dashboard with password or passkey.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-lg border bg-muted/30 p-3">
					<p className="text-muted-foreground text-xs">
						Use the same account used for onboarding and organization access.
					</p>
				</div>

				<form onSubmit={onSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								name="email"
								type="email"
								autoComplete="email webauthn"
								required
								className="h-11"
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
								className="h-11"
							/>
						</Field>
						{error ? <p className="text-destructive text-sm">{error}</p> : null}
						<div className="grid gap-2 sm:grid-cols-2">
							<Button
								type="submit"
								className="h-11 w-full"
								disabled={isSubmitting || isPasskeySubmitting}
							>
								<KeyRound className="size-4" />
								{isSubmitting ? "Signing in..." : "Sign in"}
							</Button>
							<Button
								type="button"
								variant="outline"
								className="h-11 w-full"
								onClick={() => void onPasskeySignIn()}
								disabled={isSubmitting || isPasskeySubmitting}
							>
								<Fingerprint className="size-4" />
								{isPasskeySubmitting ? "Signing in..." : "Use passkey"}
							</Button>
						</div>
						<Separator />
						<p className="text-muted-foreground text-center text-sm">
							New owner?{" "}
							<Link
								href={routes.auth.signUp}
								className="text-primary font-medium underline-offset-4 hover:underline"
							>
								Create account
							</Link>
						</p>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	)
}
