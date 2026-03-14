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
		<Card className="w-full max-w-lg border-border/70">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			{action ? <CardContent>{action}</CardContent> : null}
		</Card>
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
					<Button asChild className="h-11">
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
					<Button asChild className="h-11">
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
							className="h-11"
							onClick={() => void onSignOut()}
						>
							Sign out
						</Button>
						<Button asChild variant="outline" className="h-11">
							<Link href={routes.home}>Cancel</Link>
						</Button>
					</div>
				}
			/>
		)
	}

	if (!invitation.accountExists) {
		return (
			<Card className="w-full max-w-lg border-border/70">
				<CardHeader>
					<CardTitle>Create account to continue</CardTitle>
					<CardDescription>
						{invitation.email} was invited to join{" "}
						{invitation.organization.name} as {invitation.role ?? "member"}.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">
						No account exists for this email yet. Continue to account setup and
						we&apos;ll create the account directly from this invitation.
					</p>
					<Button asChild className="h-11 w-full">
						<Link href={routes.invitations.setup(invitationId)}>
							Continue to setup
						</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	if (hasMatchingSessionEmail) {
		return (
			<Card className="w-full max-w-lg border-border/70">
				<CardHeader>
					<CardTitle>Join {invitation.organization.name}</CardTitle>
					<CardDescription>
						Accept this invitation to join as {invitation.role ?? "member"}.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg border bg-muted/30 p-3 text-sm">
						<p>
							<span className="text-muted-foreground">Invited email:</span>{" "}
							{invitation.email}
						</p>
						<p>
							<span className="text-muted-foreground">Organization:</span>{" "}
							{invitation.organization.name}
						</p>
					</div>

					{error ? <p className="text-destructive text-sm">{error}</p> : null}

					<div className="grid gap-2 sm:grid-cols-2">
						<Button
							type="button"
							className="h-11"
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
							className="h-11"
							disabled={acceptMutation.isPending || rejectMutation.isPending}
							onClick={() => void rejectMutation.mutateAsync()}
						>
							{rejectMutation.isPending ? "Declining..." : "Decline"}
						</Button>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="w-full max-w-lg border-border/70">
			<CardHeader>
				<CardTitle>Sign in to accept invitation</CardTitle>
				<CardDescription>
					Sign in with {invitation.email} to join {invitation.organization.name}{" "}
					as {invitation.role ?? "member"}.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSignIn}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="inviteEmail">Email</FieldLabel>
							<Input
								id="inviteEmail"
								type="email"
								value={signInEmail}
								onChange={(event) => setSignInEmail(event.target.value)}
								autoComplete="email"
								className="h-11"
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
								className="h-11"
								required
							/>
						</Field>

						{error ? <p className="text-destructive text-sm">{error}</p> : null}

						<Button type="submit" className="h-11 w-full">
							Sign in
						</Button>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	)
}
