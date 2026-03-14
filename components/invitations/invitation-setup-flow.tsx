"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"

import {
	AuthInlineMessage,
	AuthMetaGrid,
	AuthPanel,
} from "@/components/auth/auth-panel"
import { Button } from "@/components/ui/button"
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
			<AuthPanel className="space-y-2">
				<p className="text-xl font-semibold tracking-tight text-foreground">
					Loading invitation
				</p>
				<p className="text-sm leading-6 text-muted-foreground">
					Checking whether this invitation is ready for account setup.
				</p>
			</AuthPanel>
		)
	}

	if (invitationQuery.isError || !invitationQuery.data) {
		return (
			<AuthPanel className="space-y-5">
				<div className="space-y-2">
					<p className="text-xl font-semibold tracking-tight text-foreground">
						Invitation unavailable
					</p>
					<p className="text-sm leading-6 text-muted-foreground">
						This invitation is invalid or no longer exists.
					</p>
				</div>
				<Button asChild size="lg" className="h-12 rounded-xl">
					<Link href={routes.home}>Go home</Link>
				</Button>
			</AuthPanel>
		)
	}

	const invitation = invitationQuery.data
	const sessionEmail = session.data?.user?.email?.trim().toLowerCase() ?? ""
	const invitationEmail = invitation.email.trim().toLowerCase()

	if (invitation.invitationState !== "pending") {
		return (
			<AuthPanel className="space-y-5">
				<div className="space-y-2">
					<p className="text-xl font-semibold tracking-tight text-foreground">
						Invitation unavailable
					</p>
					<p className="text-sm leading-6 text-muted-foreground">
						{invitation.invitationState === "expired"
							? "This invitation has expired. Ask for a new one to continue."
							: `This invitation is already ${invitation.invitationState}.`}
					</p>
				</div>
				<Button asChild size="lg" className="h-12 rounded-xl">
					<Link href={routes.home}>Go home</Link>
				</Button>
			</AuthPanel>
		)
	}

	if (invitation.accountExists) {
		return (
			<AuthPanel className="space-y-5">
				<div className="space-y-2">
					<p className="text-xl font-semibold tracking-tight text-foreground">
						Account already exists
					</p>
					<p className="text-sm leading-6 text-muted-foreground">
						{invitation.email} already has an account. Return to the accept
						screen and sign in with that email.
					</p>
				</div>
				<Button asChild size="lg" className="h-12 w-full rounded-xl">
					<Link href={routes.invitations.accept(invitationId)}>
						Back to invitation
					</Link>
				</Button>
			</AuthPanel>
		)
	}

	if (session.data?.user && sessionEmail !== invitationEmail) {
		return (
			<AuthPanel className="space-y-5">
				<div className="space-y-2">
					<p className="text-xl font-semibold tracking-tight text-foreground">
						Wrong signed-in account
					</p>
					<p className="text-sm leading-6 text-muted-foreground">
						Sign out from {session.data.user.email ?? "the current account"} to
						create the invited account for {invitation.email}.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						size="lg"
						className="h-12 rounded-xl"
						onClick={() => void onSignOut()}
					>
						Sign out
					</Button>
					<Button
						asChild
						variant="outline"
						size="lg"
						className="h-12 rounded-xl"
					>
						<Link href={routes.home}>Cancel</Link>
					</Button>
				</div>
			</AuthPanel>
		)
	}

	return (
		<AuthPanel className="space-y-5">
			<div className="space-y-2">
				<p className="text-xl font-semibold tracking-tight text-foreground">
					Create your invited account
				</p>
				<p className="text-sm leading-6 text-muted-foreground">
					Create the account for {invitation.email} and join{" "}
					{invitation.organization.name} as {invitation.role ?? "member"}.
				</p>
			</div>

			<AuthMetaGrid
				items={[
					{ label: "Organization", value: invitation.organization.name },
					{ label: "Role", value: invitation.role ?? "member" },
				]}
			/>

			<form onSubmit={onSubmit}>
				<FieldGroup className="gap-5">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="firstName">First name</FieldLabel>
							<Input
								id="firstName"
								name="firstName"
								className="h-12 rounded-xl"
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="lastName">Last name</FieldLabel>
							<Input
								id="lastName"
								name="lastName"
								className="h-12 rounded-xl"
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
							className="h-12 rounded-xl text-muted-foreground"
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
							className="h-12 rounded-xl"
							required
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							minLength={8}
							autoComplete="new-password"
							className="h-12 rounded-xl"
							required
						/>
					</Field>

					<AuthInlineMessage>
						This invitation is locked to {invitation.email}. The new account
						will join the organization immediately after creation.
					</AuthInlineMessage>

					{error ? (
						<AuthInlineMessage variant="destructive">{error}</AuthInlineMessage>
					) : null}

					<Button
						type="submit"
						size="lg"
						className="h-12 w-full rounded-xl"
						disabled={isSubmitting}
					>
						{isSubmitting ? "Creating account..." : "Create account and join"}
					</Button>
				</FieldGroup>
			</form>
		</AuthPanel>
	)
}
