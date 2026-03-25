"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useMemo, useState } from "react"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { routes } from "@/config/routes"
import { employeesQueryKeys } from "@/features/employees/queries/keys"
import { mainQueryKeys } from "@/features/main/queries/keys"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { authClient } from "@/lib/auth-client"
import { resolveErrorMessage } from "@/lib/errors"
import { feedbackMessageClassName } from "@/lib/theme-styles"

type InvitationRecord = {
	id: string
	email: string
	role?: string | null
	status?: string | null
	expiresAt?: string | Date | null
}

type OrganizationRoleRecord = {
	role: string
}

type ConfirmActionButtonProps = {
	label: string
	confirmLabel: string
	title: string
	description: string
	onConfirm: () => Promise<unknown>
	variant?: "default" | "outline" | "destructive"
	disabled?: boolean
	isPending?: boolean
	pendingLabel?: string
	className?: string
}

function ConfirmActionButton({
	label,
	confirmLabel,
	title,
	description,
	onConfirm,
	variant = "default",
	disabled = false,
	isPending = false,
	pendingLabel,
	className,
}: ConfirmActionButtonProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					type="button"
					variant={variant}
					disabled={disabled || isPending}
					className={className ?? "h-11"}
				>
					{isPending ? (pendingLabel ?? "Working...") : label}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant={variant === "destructive" ? "destructive" : "default"}
						onClick={() => void onConfirm()}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

function formatDate(value?: string | Date | null) {
	if (!value) {
		return "-"
	}

	const parsedDate = value instanceof Date ? value : new Date(value)
	if (Number.isNaN(parsedDate.getTime())) {
		return "-"
	}

	return parsedDate.toLocaleDateString()
}

export function EmployeeInvitations() {
	const queryClient = useQueryClient()
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const permissionState = authContextQuery.data?.permissions

	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const [isInviteDrawerOpen, setIsInviteDrawerOpen] = useState(false)
	const [inviteEmail, setInviteEmail] = useState("")
	const [inviteRole, setInviteRole] = useState("member")

	const rolesQuery = useQuery({
		queryKey: employeesQueryKeys.roles(activeOrganizationId),
		enabled: Boolean(activeOrganizationId),
		queryFn: async () => {
			const { data, error } = await authClient.organization.listRoles({
				query: {
					organizationId: activeOrganizationId,
				},
			})

			if (error) {
				throw new Error(error.message ?? "Failed to load roles.")
			}

			return (Array.isArray(data) ? data : []) as OrganizationRoleRecord[]
		},
	})

	const invitationsQuery = useQuery({
		queryKey: employeesQueryKeys.invitations(activeOrganizationId),
		enabled: Boolean(activeOrganizationId),
		queryFn: async () => {
			const { data, error } = await authClient.organization.listInvitations({
				query: {
					organizationId: activeOrganizationId,
				},
			})

			if (error) {
				throw new Error(error.message ?? "Failed to load invitations.")
			}

			return (Array.isArray(data) ? data : []) as InvitationRecord[]
		},
	})

	const availableRoles = useMemo(() => {
		const dynamicRoles = (rolesQuery.data ?? [])
			.map((roleRecord) => roleRecord.role)
			.filter((roleName): roleName is string => Boolean(roleName))

		return [...new Set(["member", "admin", "owner", ...dynamicRoles])]
	}, [rolesQuery.data])

	const invitations = invitationsQuery.data ?? []
	const pendingInvitations = invitations.filter(
		(invitation) => invitation.status?.toLowerCase() === "pending",
	)
	const historyInvitations = invitations.filter(
		(invitation) => invitation.status?.toLowerCase() !== "pending",
	)

	const canInviteEmployees = permissionState?.inviteEmployees ?? false

	async function invalidateInvitationQueries() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: employeesQueryKeys.invitations(activeOrganizationId),
			}),
			queryClient.invalidateQueries({ queryKey: mainQueryKeys.all }),
		])
	}

	const inviteMutation = useMutation({
		mutationFn: async () => {
			const trimmedEmail = inviteEmail.trim()
			if (!trimmedEmail) {
				throw new Error("Employee email is required.")
			}

			const { error } = await authClient.organization.inviteMember({
				email: trimmedEmail,
				role: inviteRole as "owner" | "admin" | "member",
				organizationId: activeOrganizationId,
				resend: true,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to send invitation.")
			}
		},
		onSuccess: async () => {
			await invalidateInvitationQueries()
			setInviteEmail("")
			setInviteRole("member")
			setIsInviteDrawerOpen(false)
			setMessage("Invitation sent.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(resolveErrorMessage(mutationError, "Failed to send invitation."))
			setMessage(null)
		},
	})

	const resendInvitationMutation = useMutation({
		mutationFn: async (input: { email: string; role: string }) => {
			const { error } = await authClient.organization.inviteMember({
				email: input.email,
				role: input.role as "owner" | "admin" | "member",
				organizationId: activeOrganizationId,
				resend: true,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to resend invitation.")
			}
		},
		onSuccess: async () => {
			await invalidateInvitationQueries()
			setMessage("Invitation resent.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(
				resolveErrorMessage(mutationError, "Failed to resend invitation."),
			)
			setMessage(null)
		},
	})

	const cancelInvitationMutation = useMutation({
		mutationFn: async (invitationId: string) => {
			const { error } = await authClient.organization.cancelInvitation({
				invitationId,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to cancel invitation.")
			}
		},
		onSuccess: async () => {
			await invalidateInvitationQueries()
			setMessage("Invitation canceled.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(
				resolveErrorMessage(mutationError, "Failed to cancel invitation."),
			)
			setMessage(null)
		},
	})

	if (!activeOrganizationId) {
		return (
			<div className="max-w-5xl space-y-4">
				<PageSectionHeader
					title="Invitations"
					description="Select an active organization first."
				/>
			</div>
		)
	}

	return (
		<div className="max-w-5xl space-y-8">
			<PageSectionHeader
				title="Invitations"
				description="Manage pending and historical employee invitations."
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setIsInviteDrawerOpen(true)}
							disabled={!canInviteEmployees}
						>
							Invite employee
						</Button>
						<Button asChild variant="outline" className="h-11">
							<Link href={routes.app.employees}>Back to employees</Link>
						</Button>
					</div>
				}
			/>

			{message ? (
				<p className={feedbackMessageClassName("success")}>{message}</p>
			) : null}
			{error ? <p className="text-destructive text-sm">{error}</p> : null}

			<section className="space-y-2">
				<div className="space-y-1">
					<h2 className="text-base font-semibold">Pending invitations</h2>
				</div>
				<Separator />

				{invitationsQuery.isPending ? (
					<p className="text-muted-foreground text-sm">
						Loading invitations...
					</p>
				) : null}

				{!invitationsQuery.isPending && pendingInvitations.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No pending invitations.
					</p>
				) : null}

				<div className="space-y-3">
					{pendingInvitations.map((invitation) => (
						<div
							key={invitation.id}
							className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
						>
							<div className="space-y-1">
								<p className="text-sm font-medium">{invitation.email}</p>
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="secondary">
										{invitation.role ?? "member"}
									</Badge>
									<p className="text-muted-foreground text-xs">
										Expires {formatDate(invitation.expiresAt)}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-2 md:justify-end">
								<ConfirmActionButton
									label="Resend"
									confirmLabel="Resend"
									title="Resend invitation"
									description="Confirm you want to resend this invitation."
									onConfirm={() =>
										resendInvitationMutation.mutateAsync({
											email: invitation.email,
											role: invitation.role ?? "member",
										})
									}
									variant="outline"
									disabled={!canInviteEmployees}
									isPending={resendInvitationMutation.isPending}
									pendingLabel="Resending..."
									className="h-10"
								/>
								<ConfirmActionButton
									label="Cancel"
									confirmLabel="Cancel"
									title="Cancel invitation"
									description="Confirm you want to cancel this invitation."
									onConfirm={() =>
										cancelInvitationMutation.mutateAsync(invitation.id)
									}
									variant="destructive"
									disabled={!canInviteEmployees}
									isPending={cancelInvitationMutation.isPending}
									pendingLabel="Canceling..."
									className="h-10"
								/>
							</div>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-2">
				<div className="space-y-1">
					<h2 className="text-base font-semibold">Invitation history</h2>
				</div>
				<Separator />

				{historyInvitations.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No processed invitations.
					</p>
				) : null}

				<div className="space-y-3">
					{historyInvitations.map((invitation) => (
						<div
							key={invitation.id}
							className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
						>
							<div className="space-y-1">
								<p className="text-sm font-medium">{invitation.email}</p>
								<p className="text-muted-foreground text-xs">
									Role: {invitation.role ?? "member"}
								</p>
							</div>
							<Badge variant="secondary" className="sm:justify-self-end">
								{invitation.status ?? "unknown"}
							</Badge>
						</div>
					))}
				</div>
			</section>

			<ResponsiveDrawer
				open={isInviteDrawerOpen}
				onOpenChange={setIsInviteDrawerOpen}
				title="Invite employee"
				description="Send an invitation email to join this organization."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="inviteEmail">Employee email</FieldLabel>
							<Input
								id="inviteEmail"
								type="email"
								value={inviteEmail}
								onChange={(event) => setInviteEmail(event.target.value)}
								className="h-11"
								disabled={!canInviteEmployees || inviteMutation.isPending}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="inviteRole">Role</FieldLabel>
							<Select
								value={inviteRole}
								onValueChange={setInviteRole}
								disabled={!canInviteEmployees || inviteMutation.isPending}
							>
								<SelectTrigger id="inviteRole" className="h-11 w-full">
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									{availableRoles
										.filter((roleName) => roleName !== "owner")
										.map((roleName) => (
											<SelectItem key={roleName} value={roleName}>
												{roleName}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</Field>
					</FieldGroup>

					<div className="flex justify-end">
						<ConfirmActionButton
							label="Send invitation"
							confirmLabel="Send"
							title="Send invitation"
							description="Confirm you want to send this employee invitation."
							onConfirm={() => inviteMutation.mutateAsync()}
							disabled={!canInviteEmployees || !inviteEmail.trim()}
							isPending={inviteMutation.isPending}
							pendingLabel="Sending..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>
		</div>
	)
}
