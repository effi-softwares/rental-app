"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react"

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

type InvitationAcceptFlowProps = {
	invitationId: string
}

function InvitationUnavailableCard({
	title,
	description,
	action,
}: {
	title: string
	description: string
	action?: ReactNode
}) {
	return (
		<AuthPanel className="space-y-5">
			<div className="space-y-2">
				<p className="text-xl font-semibold tracking-tight text-foreground">
					{title}
				</p>
				<p className="text-sm leading-6 text-muted-foreground">{description}</p>
			</div>
			{action ? <div>{action}</div> : null}
		</AuthPanel>
	)
}

export function InvitationAcceptFlow({
	invitationId,
}: InvitationAcceptFlowProps) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const session = authClient.useSession()

	const [signInEmail, setSignInEmail] = useState("")
	const [signInPassword, setSignInPassword] = useState("")
	const [error, setError] = useState<string | null>(null)

	const invitationPath = routes.invitations.accept(invitationId)

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

	const acceptMutation = useMutation({
		mutationFn: async (organizationId: string) => {
			const { error: acceptError } =
				await authClient.organization.acceptInvitation({
					invitationId,
				})

			if (acceptError) {
				throw new Error(acceptError.message ?? "Failed to accept invitation.")
			}

			await setActiveOrganization(organizationId)
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: mainQueryKeys.all }),
				queryClient.invalidateQueries({
					queryKey: invitationsQueryKeys.detail(invitationId),
				}),
			])
			router.replace(routes.app.root)
			router.refresh()
		},
		onError: (mutationError) => {
			setError(mutationError.message)
		},
	})

	const rejectMutation = useMutation({
		mutationFn: async () => {
			const { error: rejectError } =
				await authClient.organization.rejectInvitation({
					invitationId,
				})

			if (rejectError) {
				throw new Error(rejectError.message ?? "Failed to reject invitation.")
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: mainQueryKeys.all }),
				queryClient.invalidateQueries({
					queryKey: invitationsQueryKeys.detail(invitationId),
				}),
			])
			router.replace(routes.home)
			router.refresh()
		},
		onError: (mutationError) => {
			setError(mutationError.message)
		},
	})

	useEffect(() => {
		if (!signInEmail && invitationQuery.data?.email) {
			setSignInEmail(invitationQuery.data.email)
		}
	}, [invitationQuery.data?.email, signInEmail])

	const invitationEmail = useMemo(
		() => invitationQuery.data?.email.trim().toLowerCase() ?? "",
		[invitationQuery.data?.email],
	)
	const sessionEmail = session.data?.user?.email?.trim().toLowerCase() ?? ""
	const hasMatchingSessionEmail =
		Boolean(session.data?.user) && sessionEmail === invitationEmail

	async function onSignIn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		if (!invitationEmail) {
			setError("Invitation is missing an email address.")
			return
		}

		const normalizedEmail = signInEmail.trim().toLowerCase()
		if (normalizedEmail !== invitationEmail) {
			setError("Sign in with the same email that received this invitation.")
			return
		}

		setError(null)

		const { data, error: signInError } = await authClient.signIn.email({
			email: normalizedEmail,
			password: signInPassword,
			callbackURL: invitationPath,
			rememberMe: true,
		})

		if (signInError) {
			setError(signInError.message ?? "Unable to sign in.")
			return
		}

		if (
			data &&
			typeof data === "object" &&
			"twoFactorRedirect" in data &&
			Boolean(data.twoFactorRedirect)
		) {
			router.replace(
				`${routes.auth.twoFactor}?redirectTo=${encodeURIComponent(invitationPath)}`,
			)
			router.refresh()
			return
		}

		router.refresh()
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
			<InvitationUnavailableCard
				title="Loading invitation"
				description="Checking invitation details and account status."
			/>
		)
	}

	if (invitationQuery.isError || !invitationQuery.data) {
		return (
			<InvitationUnavailableCard
				title="Invitation unavailable"
				description="This invitation is invalid or no longer exists."
				action={
					<Button asChild size="lg" className="h-12 rounded-xl">
						<Link href={routes.home}>Go home</Link>
					</Button>
				}
			/>
		)
	}

	const invitation = invitationQuery.data

	if (invitation.invitationState !== "pending") {
		const description =
			invitation.invitationState === "expired"
				? "This invitation has expired. Ask an organization owner to send a new one."
				: `This invitation is already ${invitation.invitationState}.`

		return (
			<InvitationUnavailableCard
				title="Invitation unavailable"
				description={description}
				action={
					<Button asChild size="lg" className="h-12 rounded-xl">
						<Link href={routes.home}>Go home</Link>
					</Button>
				}
			/>
		)
	}

	if (session.data?.user && !hasMatchingSessionEmail) {
		return (
			<InvitationUnavailableCard
				title="Wrong signed-in account"
				description={`This invitation is for ${invitation.email}. Sign out from ${session.data.user.email ?? "the current account"} and continue with the invited email.`}
				action={
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
				}
			/>
		)
	}

	if (!invitation.accountExists) {
		return (
			<AuthPanel className="space-y-5">
				<div className="space-y-2">
					<p className="text-xl font-semibold tracking-tight text-foreground">
						Create account to continue
					</p>
					<p className="text-sm leading-6 text-muted-foreground">
						{invitation.email} was invited to join{" "}
						{invitation.organization.name} as {invitation.role ?? "member"}.
					</p>
				</div>
				<AuthInlineMessage>
					No account exists for this email yet. Continue to account setup and
					we&apos;ll create the account directly from this invitation.
				</AuthInlineMessage>
				<Button asChild size="lg" className="h-12 w-full rounded-xl">
					<Link href={routes.invitations.setup(invitationId)}>
						Continue to setup
					</Link>
				</Button>
			</AuthPanel>
		)
	}

	if (hasMatchingSessionEmail) {
		return (
			<AuthPanel className="space-y-5">
				<div className="space-y-2">
					<p className="text-xl font-semibold tracking-tight text-foreground">
						Join {invitation.organization.name}
					</p>
					<p className="text-sm leading-6 text-muted-foreground">
						Accept this invitation to join as {invitation.role ?? "member"}.
					</p>
				</div>

				<AuthMetaGrid
					items={[
						{ label: "Invited email", value: invitation.email },
						{ label: "Organization", value: invitation.organization.name },
					]}
				/>

				{error ? (
					<AuthInlineMessage variant="destructive">{error}</AuthInlineMessage>
				) : null}

				<div className="grid gap-2 sm:grid-cols-2">
					<Button
						type="button"
						size="lg"
						className="h-12 rounded-xl"
						disabled={acceptMutation.isPending || rejectMutation.isPending}
						onClick={() =>
							void acceptMutation.mutateAsync(invitation.organization.id)
						}
					>
						{acceptMutation.isPending ? "Joining..." : "Accept invitation"}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="lg"
						className="h-12 rounded-xl"
						disabled={acceptMutation.isPending || rejectMutation.isPending}
						onClick={() => void rejectMutation.mutateAsync()}
					>
						{rejectMutation.isPending ? "Declining..." : "Decline"}
					</Button>
				</div>
			</AuthPanel>
		)
	}

	return (
		<AuthPanel className="space-y-5">
			<div className="space-y-2">
				<p className="text-xl font-semibold tracking-tight text-foreground">
					Sign in to accept invitation
				</p>
				<p className="text-sm leading-6 text-muted-foreground">
					Sign in with {invitation.email} to join {invitation.organization.name}{" "}
					as {invitation.role ?? "member"}.
				</p>
			</div>

			<form onSubmit={onSignIn}>
				<FieldGroup className="gap-5">
					<AuthInlineMessage>
						Use the exact invited email so the workspace can match this account
						to the invitation.
					</AuthInlineMessage>

					<Field>
						<FieldLabel htmlFor="inviteEmail">Email</FieldLabel>
						<Input
							id="inviteEmail"
							type="email"
							value={signInEmail}
							onChange={(event) => setSignInEmail(event.target.value)}
							autoComplete="email"
							className="h-12 rounded-xl"
							required
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor="password">Password</FieldLabel>
						<Input
							id="password"
							type="password"
							value={signInPassword}
							onChange={(event) => setSignInPassword(event.target.value)}
							autoComplete="current-password"
							className="h-12 rounded-xl"
							required
						/>
					</Field>

					{error ? (
						<AuthInlineMessage variant="destructive">{error}</AuthInlineMessage>
					) : null}

					<Button type="submit" size="lg" className="h-12 w-full rounded-xl">
						Sign in
					</Button>
				</FieldGroup>
			</form>
		</AuthPanel>
	)
}
