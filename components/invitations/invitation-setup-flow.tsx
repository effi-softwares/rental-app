"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import { routes } from "@/config/routes"
import { invitationsQueryKeys } from "@/features/invitations/queries/keys"
import { setActiveOrganization } from "@/features/main/mutations/active-organization"
import { mainQueryKeys } from "@/features/main/queries/keys"
import { authClient } from "@/lib/auth-client"

type InvitationDetails = {
	id: string
	email: string
	role?: string | null
	status: string
	invitationState: string
	expiresAt: string
	accountExists: boolean
	organization: {
		id: string
		name: string
		slug: string
		logo?: string | null
	}
}

type InvitationSetupFlowProps = {
	invitationId: string
}

export function InvitationSetupFlow({
	invitationId,
}: InvitationSetupFlowProps) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const session = authClient.useSession()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const invitationQuery = useQuery({
		queryKey: invitationsQueryKeys.detail(invitationId),
		queryFn: async () => {
			const response = await fetch(`/api/invitations/${invitationId}`)
			const payload = (await response.json().catch(() => null)) as
				| (InvitationDetails & { error?: string })
				| null

			if (!response.ok) {
				throw new Error(payload?.error ?? "Invitation not found.")
			}

			return payload as InvitationDetails
		},
	})

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		const invitation = invitationQuery.data
		if (!invitation) {
			setError("Invitation details are unavailable.")
			return
		}

		const formData = new FormData(event.currentTarget)
		const firstName = String(formData.get("firstName") ?? "").trim()
		const lastName = String(formData.get("lastName") ?? "").trim()
		const password = String(formData.get("password") ?? "")
		const confirmPassword = String(formData.get("confirmPassword") ?? "")
		const name = `${firstName} ${lastName}`.trim()

		if (!name) {
			setError("Your name is required.")
			return
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match.")
			return
		}

		setIsSubmitting(true)
		setError(null)

		try {
			const { error: signUpError } = await authClient.signUp.email({
				name,
				email: invitation.email,
				password,
				callbackURL: routes.invitations.setup(invitationId),
			})

			if (signUpError) {
				throw new Error(signUpError.message ?? "Unable to create account.")
			}

			const { error: acceptError } =
				await authClient.organization.acceptInvitation({
					invitationId,
				})

			if (acceptError) {
				throw new Error(acceptError.message ?? "Unable to accept invitation.")
			}

			await setActiveOrganization(invitation.organization.id)

			await Promise.all([
				queryClient.invalidateQueries({ queryKey: mainQueryKeys.all }),
				queryClient.invalidateQueries({
					queryKey: invitationsQueryKeys.detail(invitationId),
				}),
			])

			router.replace(routes.app.root)
			router.refresh()
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Unable to create account from this invitation.",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	async function onSignOut() {
		setError(null)

		const { error: signOutError } = await authClient.signOut()
		if (signOutError) {
			setError(signOutError.message ?? "Unable to sign out.")
			return
		}

		await queryClient.invalidateQueries({ queryKey: mainQueryKeys.all })
		router.refresh()
	}

	if (invitationQuery.isPending) {
		return (
			<Card className="w-full max-w-lg border-border/70">
				<CardHeader>
					<CardTitle>Loading invitation</CardTitle>
					<CardDescription>
						Checking whether this invitation is ready for account setup.
					</CardDescription>
				</CardHeader>
			</Card>
		)
	}

	if (invitationQuery.isError || !invitationQuery.data) {
		return (
			<Card className="w-full max-w-lg border-border/70">
				<CardHeader>
					<CardTitle>Invitation unavailable</CardTitle>
					<CardDescription>
						This invitation is invalid or no longer exists.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild className="h-11">
						<Link href={routes.home}>Go home</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	const invitation = invitationQuery.data
	const sessionEmail = session.data?.user?.email?.trim().toLowerCase() ?? ""
	const invitationEmail = invitation.email.trim().toLowerCase()

	if (invitation.invitationState !== "pending") {
		return (
			<Card className="w-full max-w-lg border-border/70">
				<CardHeader>
					<CardTitle>Invitation unavailable</CardTitle>
					<CardDescription>
						{invitation.invitationState === "expired"
							? "This invitation has expired. Ask for a new one to continue."
							: `This invitation is already ${invitation.invitationState}.`}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild className="h-11">
						<Link href={routes.home}>Go home</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	if (invitation.accountExists) {
		return (
			<Card className="w-full max-w-lg border-border/70">
				<CardHeader>
					<CardTitle>Account already exists</CardTitle>
					<CardDescription>
						{invitation.email} already has an account. Return to the accept
						screen and sign in with that email.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild className="h-11 w-full">
						<Link href={routes.invitations.accept(invitationId)}>
							Back to invitation
						</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	if (session.data?.user && sessionEmail !== invitationEmail) {
		return (
			<Card className="w-full max-w-lg border-border/70">
				<CardHeader>
					<CardTitle>Wrong signed-in account</CardTitle>
					<CardDescription>
						Sign out from {session.data.user.email ?? "the current account"} to
						create the invited account for {invitation.email}.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Button
						type="button"
						className="h-11"
						onClick={() => void onSignOut()}
					>
						Sign out
					</Button>
					<Button asChild variant="outline" className="h-11">
						<Link href={routes.home}>Cancel</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="w-full max-w-lg border-border/70">
			<CardHeader>
				<CardTitle>Create your invited account</CardTitle>
				<CardDescription>
					Create the account for {invitation.email} and join{" "}
					{invitation.organization.name} as {invitation.role ?? "member"}.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit}>
					<FieldGroup>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor="firstName">First name</FieldLabel>
								<Input
									id="firstName"
									name="firstName"
									className="h-11"
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="lastName">Last name</FieldLabel>
								<Input
									id="lastName"
									name="lastName"
									className="h-11"
									required
								/>
							</Field>
						</div>

						<Field>
							<FieldLabel htmlFor="email">Invited email</FieldLabel>
							<Input
								id="email"
								value={invitation.email}
								readOnly
								className="text-muted-foreground h-11"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								name="password"
								type="password"
								minLength={8}
								autoComplete="new-password"
								className="h-11"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="confirmPassword">
								Confirm password
							</FieldLabel>
							<Input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								minLength={8}
								autoComplete="new-password"
								className="h-11"
								required
							/>
						</Field>

						{error ? <p className="text-destructive text-sm">{error}</p> : null}

						<Button
							type="submit"
							className="h-11 w-full"
							disabled={isSubmitting}
						>
							{isSubmitting ? "Creating account..." : "Create account and join"}
						</Button>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	)
}
