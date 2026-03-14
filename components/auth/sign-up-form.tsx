"use client"

import { useQueryClient } from "@tanstack/react-query"
import { UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"

import { AuthInlineMessage, AuthPanel } from "@/components/auth/auth-panel"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { routes } from "@/config/routes"
import { mainQueryKeys } from "@/features/main/queries/keys"
import { authClient } from "@/lib/auth-client"
import { signUpOnboardingGateApiPath } from "@/lib/auth-flow"

export function SignUpForm() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError(null)
		setIsSubmitting(true)

		const formData = new FormData(event.currentTarget)
		const firstName = String(formData.get("firstName") ?? "").trim()
		const lastName = String(formData.get("lastName") ?? "").trim()
		const email = String(formData.get("email") ?? "").trim()
		const password = String(formData.get("password") ?? "")
		const name = `${firstName} ${lastName}`.trim()

		const { error: signUpError } = await authClient.signUp.email({
			name,
			email,
			password,
			callbackURL: routes.auth.signUpOnboarding,
		})

		setIsSubmitting(false)

		if (signUpError) {
			setError(
				signUpError.message ?? "Unable to create account. Please try again.",
			)
			return
		}

		const startFlowResponse = await fetch(signUpOnboardingGateApiPath, {
			method: "POST",
		})

		if (!startFlowResponse.ok) {
			setError("Account created, but sign-up flow could not continue.")
			return
		}

		await queryClient.invalidateQueries({ queryKey: mainQueryKeys.all })

		router.replace(routes.auth.signUpOnboarding)
		router.refresh()
	}

	return (
		<AuthPanel className="space-y-6">
			<form onSubmit={onSubmit}>
				<FieldGroup className="gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="firstName">First name</FieldLabel>
							<Input
								id="firstName"
								name="firstName"
								required
								className="h-12 rounded-xl"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="lastName">Last name</FieldLabel>
							<Input
								id="lastName"
								name="lastName"
								required
								className="h-12 rounded-xl"
							/>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor="email">Email</FieldLabel>
						<Input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
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
							autoComplete="new-password"
							minLength={8}
							required
							className="h-12 rounded-xl"
						/>
					</Field>

					<p className="text-xs leading-5 text-muted-foreground">
						Use at least 8 characters. You can add passkeys and two-factor
						verification after account creation.
					</p>

					{error ? (
						<AuthInlineMessage variant="destructive">{error}</AuthInlineMessage>
					) : null}

					<Button
						type="submit"
						size="lg"
						className="h-12 w-full rounded-xl"
						disabled={isSubmitting}
					>
						<UserPlus className="size-4" />
						{isSubmitting ? "Creating account..." : "Create owner account"}
					</Button>

					<p className="text-center text-sm text-muted-foreground">
						Already have an account?{" "}
						<Link
							href={routes.auth.signIn}
							className="font-medium text-foreground underline underline-offset-4"
						>
							Sign in
						</Link>
					</p>
				</FieldGroup>
			</form>
		</AuthPanel>
	)
}
