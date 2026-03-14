"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Sparkles, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
		<Card className="w-full max-w-lg border-border/70">
			<CardHeader>
				<div className="mb-1 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary/10 px-4 text-primary text-sm font-medium">
					<Sparkles className="size-4" />
					Get started
				</div>
				<CardTitle className="text-xl">Create owner account</CardTitle>
				<CardDescription>
					Set up your internal rental operations workspace.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-lg border bg-muted/30 p-3">
					<p className="text-muted-foreground text-xs">
						This account will become the initial owner of your organization.
					</p>
				</div>

				<form onSubmit={onSubmit}>
					<FieldGroup>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor="firstName">First name</FieldLabel>
								<Input
									id="firstName"
									name="firstName"
									required
									className="h-11"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="lastName">Last name</FieldLabel>
								<Input
									id="lastName"
									name="lastName"
									required
									className="h-11"
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
								className="h-11"
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
								className="h-11"
							/>
						</Field>
						{error ? <p className="text-destructive text-sm">{error}</p> : null}
						<Button
							type="submit"
							className="h-11 w-full"
							disabled={isSubmitting}
						>
							<UserPlus className="size-4" />
							{isSubmitting ? "Creating account..." : "Create account"}
						</Button>
						<Separator />
						<p className="text-muted-foreground text-center text-sm">
							Already have an account?{" "}
							<Link
								href={routes.auth.signIn}
								className="text-primary font-medium underline-offset-4 hover:underline"
							>
								Sign in
							</Link>
						</p>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	)
}
