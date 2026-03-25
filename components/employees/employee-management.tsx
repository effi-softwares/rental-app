"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { MouseEvent } from "react"
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

type MemberUser = {
	id?: string
	name?: string | null
	email?: string | null
	banned?: boolean | null
}

type MemberRecord = {
	id: string
	role?: string | null
	userId?: string
	user?: MemberUser
}

type OrganizationRoleRecord = {
	id?: string
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
	onTriggerClick?: (event: MouseEvent<HTMLButtonElement>) => void
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
	onTriggerClick,
}: ConfirmActionButtonProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					type="button"
					variant={variant}
					disabled={disabled || isPending}
					className={className ?? "h-11"}
					onClick={onTriggerClick}
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

export function EmployeeManagement() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const session = authClient.useSession()
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const permissionState = authContextQuery.data?.permissions
	const platformUserRole = (session.data?.user as { role?: string } | undefined)
		?.role
	const canUseAdminApis = platformUserRole === "admin"

	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const [isAddEmployeeDrawerOpen, setIsAddEmployeeDrawerOpen] = useState(false)
	const [addEmployeeEmail, setAddEmployeeEmail] = useState("")
	const [addEmployeeRole, setAddEmployeeRole] = useState("member")

	const [isRoleDrawerOpen, setIsRoleDrawerOpen] = useState(false)
	const [roleTargetMemberId, setRoleTargetMemberId] = useState<string | null>(
		null,
	)
	const [roleTargetRole, setRoleTargetRole] = useState("member")

	const membersQuery = useQuery({
		queryKey: employeesQueryKeys.members(activeOrganizationId),
		enabled: Boolean(activeOrganizationId),
		queryFn: async () => {
			const { data, error } = await authClient.organization.listMembers({
				query: {
					organizationId: activeOrganizationId,
					limit: 100,
					offset: 0,
				},
			})

			if (error) {
				throw new Error(error.message ?? "Failed to load members.")
			}

			if (Array.isArray(data)) {
				return data as MemberRecord[]
			}

			if (
				typeof data === "object" &&
				data !== null &&
				"members" in data &&
				Array.isArray((data as { members?: unknown }).members)
			) {
				return (data as { members: MemberRecord[] }).members
			}

			return [] as MemberRecord[]
		},
	})

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
				throw new Error(error.message ?? "Failed to load organization roles.")
			}

			return (Array.isArray(data) ? data : []) as OrganizationRoleRecord[]
		},
	})

	const members = membersQuery.data ?? []
	const dynamicRoleRecords = rolesQuery.data ?? []
	const nonOwnerMembers = useMemo(() => {
		return members.filter((member) => member.role?.toLowerCase() !== "owner")
	}, [members])

	const viewerMemberRole = useMemo(() => {
		const sessionUserId = session.data?.user?.id
		const sessionMember = members.find(
			(member) =>
				member.userId === sessionUserId || member.user?.id === sessionUserId,
		)

		if (sessionMember?.role) {
			return sessionMember.role.toLowerCase()
		}

		return "member"
	}, [members, session.data?.user?.id])

	const availableRoles = useMemo(() => {
		const dynamicRoles = dynamicRoleRecords
			.map((roleRecord) => roleRecord.role)
			.filter((roleName): roleName is string => Boolean(roleName))

		return [...new Set(["member", "admin", "owner", ...dynamicRoles])]
	}, [dynamicRoleRecords])

	const canTakeEmployeeActions = viewerMemberRole === "owner"
	const canRunPlatformAdminActions = canTakeEmployeeActions && canUseAdminApis
	const canInviteEmployees =
		(permissionState?.inviteEmployees ?? false) && canTakeEmployeeActions
	const canManageEmployeeRoles =
		(permissionState?.manageEmployeeRoles ?? false) && canTakeEmployeeActions
	const canRemoveEmployees =
		(permissionState?.removeEmployees ?? false) && canTakeEmployeeActions

	async function invalidateEmployeeQueries() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: employeesQueryKeys.members(activeOrganizationId),
			}),
			queryClient.invalidateQueries({
				queryKey: mainQueryKeys.all,
			}),
		])
	}

	const inviteEmployeeMutation = useMutation({
		mutationFn: async (input: { email: string; role: string }) => {
			const response = await fetch("/api/employees", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(input),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null

				throw new Error(payload?.error ?? "Failed to send employee invitation.")
			}
		},
		onSuccess: async () => {
			await invalidateEmployeeQueries()
			setMessage("Employee invitation sent.")
			setError(null)
			setAddEmployeeEmail("")
			setAddEmployeeRole("member")
			setIsAddEmployeeDrawerOpen(false)
		},
		onError: (mutationError) => {
			setError(
				resolveErrorMessage(
					mutationError,
					"Failed to send employee invitation.",
				),
			)
			setMessage(null)
		},
	})

	const updateMemberRoleMutation = useMutation({
		mutationFn: async (input: { memberId: string; nextRole: string }) => {
			const { error } = await authClient.organization.updateMemberRole({
				memberId: input.memberId,
				role: input.nextRole,
				organizationId: activeOrganizationId,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to update member role.")
			}
		},
		onSuccess: async () => {
			await invalidateEmployeeQueries()
			setMessage("Employee role updated.")
			setError(null)
			setIsRoleDrawerOpen(false)
			setRoleTargetMemberId(null)
		},
		onError: (mutationError) => {
			setError(
				resolveErrorMessage(mutationError, "Failed to update member role."),
			)
			setMessage(null)
		},
	})

	const removeMemberMutation = useMutation({
		mutationFn: async (memberId: string) => {
			const { error } = await authClient.organization.removeMember({
				memberIdOrEmail: memberId,
				organizationId: activeOrganizationId,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to remove member.")
			}
		},
		onSuccess: async () => {
			await invalidateEmployeeQueries()
			setMessage("Employee removed from organization.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(resolveErrorMessage(mutationError, "Failed to remove member."))
			setMessage(null)
		},
	})

	const banUserMutation = useMutation({
		mutationFn: async (userId: string) => {
			if (!canUseAdminApis) {
				throw new Error(
					"Platform admin access is required to suspend or unsuspend users.",
				)
			}

			const { error } = await authClient.admin.banUser({
				userId,
				banReason: "Suspended by organization owner",
			})

			if (error) {
				throw new Error(error.message ?? "Failed to suspend employee.")
			}
		},
		onSuccess: async () => {
			await invalidateEmployeeQueries()
			setMessage("Employee suspended.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(
				resolveErrorMessage(mutationError, "Failed to suspend employee."),
			)
			setMessage(null)
		},
	})

	const unbanUserMutation = useMutation({
		mutationFn: async (userId: string) => {
			if (!canUseAdminApis) {
				throw new Error(
					"Platform admin access is required to suspend or unsuspend users.",
				)
			}

			const { error } = await authClient.admin.unbanUser({
				userId,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to unsuspend employee.")
			}
		},
		onSuccess: async () => {
			await invalidateEmployeeQueries()
			setMessage("Employee unsuspended.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(
				resolveErrorMessage(mutationError, "Failed to unsuspend employee."),
			)
			setMessage(null)
		},
	})

	function openRoleDrawer(member: MemberRecord) {
		setRoleTargetMemberId(member.id)
		setRoleTargetRole(member.role ?? "member")
		setIsRoleDrawerOpen(true)
	}

	if (!activeOrganizationId) {
		return (
			<div className="max-w-5xl space-y-4">
				<PageSectionHeader
					title="Employee management"
					description="Select an active organization first."
				/>
			</div>
		)
	}

	const isLoading = membersQuery.isPending || rolesQuery.isPending

	return (
		<div className="max-w-6xl space-y-8">
			<PageSectionHeader
				title="Employee management"
				description="Table-first employee operations with details pages and confirmation-gated actions."
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setIsAddEmployeeDrawerOpen(true)}
							disabled={!canInviteEmployees}
						>
							<UserPlus className="mr-2 size-4" /> Invite employee
						</Button>
						<Button asChild variant="outline" className="h-11">
							<Link href={routes.app.employeeInvitations}>Invitations</Link>
						</Button>
					</div>
				}
			/>

			<section className="space-y-2">
				<div className="space-y-1">
					<h2 className="text-base font-semibold">Employee table</h2>
					<p className="text-muted-foreground text-sm">
						Tap any row to open employee details. Use row actions for quick
						updates.
					</p>
				</div>
				<Separator />

				<div className="grid gap-3 py-4 sm:grid-cols-3">
					<div className="rounded-md border px-3 py-2">
						<p className="text-muted-foreground text-xs">Members</p>
						<p className="text-sm font-semibold">{nonOwnerMembers.length}</p>
					</div>
					<div className="rounded-md border px-3 py-2">
						<p className="text-muted-foreground text-xs">Your access</p>
						<p className="text-sm font-semibold capitalize">
							{viewerMemberRole}
						</p>
					</div>
					<div className="rounded-md border px-3 py-2">
						<p className="text-muted-foreground text-xs">Action scope</p>
						<p className="text-sm font-semibold">
							{canRunPlatformAdminActions
								? "Owner + platform admin"
								: "Owner only"}
						</p>
					</div>
				</div>

				{message ? (
					<p className={feedbackMessageClassName("success")}>{message}</p>
				) : null}
				{error ? <p className="text-destructive text-sm">{error}</p> : null}

				{!canTakeEmployeeActions ? (
					<p className="text-muted-foreground text-sm">
						Read-only access: only owners can run employee actions.
					</p>
				) : null}

				{isLoading ? (
					<p className="text-muted-foreground text-sm">Loading employees...</p>
				) : null}

				{!isLoading && nonOwnerMembers.length === 0 ? (
					<p className="text-muted-foreground text-sm">No employees found.</p>
				) : null}

				{nonOwnerMembers.length > 0 ? (
					<>
						<div className="space-y-3 md:hidden">
							{nonOwnerMembers.map((member) => {
								const userId = member.userId ?? member.user?.id
								const memberIsBanned = Boolean(member.user?.banned)

								return (
									<div
										key={member.id}
										className="space-y-3 rounded-md border p-3"
									>
										<button
											type="button"
											className="w-full space-y-1 text-left"
											onClick={() =>
												router.push(routes.app.employeeDetails(member.id))
											}
										>
											<p className="text-sm font-medium">
												{member.user?.name ?? "Unnamed user"}
											</p>
											<p className="text-muted-foreground text-xs">
												{member.user?.email ?? "-"}
											</p>
										</button>
										<div className="flex flex-wrap gap-2">
											<Badge variant="secondary">
												{member.role ?? "member"}
											</Badge>
											<Badge
												variant={memberIsBanned ? "destructive" : "secondary"}
											>
												{memberIsBanned ? "Suspended" : "Active"}
											</Badge>
										</div>
										<div className="grid gap-2">
											<Button
												type="button"
												variant="outline"
												className="h-11"
												onClick={() => openRoleDrawer(member)}
												disabled={!canManageEmployeeRoles}
											>
												Change role
											</Button>
											<ConfirmActionButton
												label={memberIsBanned ? "Unsuspend" : "Suspend"}
												confirmLabel={memberIsBanned ? "Unsuspend" : "Suspend"}
												title={
													memberIsBanned
														? "Unsuspend employee"
														: "Suspend employee"
												}
												description={
													memberIsBanned
														? "Confirm you want to unsuspend this employee account."
														: "Confirm you want to suspend this employee account."
												}
												onConfirm={() => {
													if (!userId) {
														throw new Error("Unable to find employee account.")
													}

													return memberIsBanned
														? unbanUserMutation.mutateAsync(userId)
														: banUserMutation.mutateAsync(userId)
												}}
												variant="outline"
												disabled={!canRunPlatformAdminActions || !userId}
												isPending={
													banUserMutation.isPending ||
													unbanUserMutation.isPending
												}
												pendingLabel="Updating..."
											/>
											<ConfirmActionButton
												label="Remove"
												confirmLabel="Remove"
												title="Remove employee"
												description="Confirm you want to remove this employee from the organization."
												onConfirm={() =>
													removeMemberMutation.mutateAsync(member.id)
												}
												variant="destructive"
												disabled={!canRemoveEmployees}
												isPending={removeMemberMutation.isPending}
												pendingLabel="Removing..."
											/>
										</div>
									</div>
								)
							})}
						</div>

						<div className="hidden overflow-x-auto rounded-md border md:block">
							<table className="w-full min-w-190 text-left text-sm">
								<thead className="bg-muted/50 text-muted-foreground">
									<tr>
										<th className="px-3 py-2 font-medium">Name</th>
										<th className="px-3 py-2 font-medium">Email</th>
										<th className="px-3 py-2 font-medium">Role</th>
										<th className="px-3 py-2 font-medium">Status</th>
										<th className="px-3 py-2 font-medium">Actions</th>
									</tr>
								</thead>
								<tbody>
									{nonOwnerMembers.map((member) => {
										const userId = member.userId ?? member.user?.id
										const memberIsBanned = Boolean(member.user?.banned)

										return (
											<tr
												key={member.id}
												className="cursor-pointer border-t align-middle transition-colors hover:bg-muted/30"
												onClick={() =>
													router.push(routes.app.employeeDetails(member.id))
												}
											>
												<td className="px-3 py-2 font-medium">
													{member.user?.name ?? "Unnamed user"}
												</td>
												<td className="px-3 py-2 text-muted-foreground">
													{member.user?.email ?? "-"}
												</td>
												<td className="px-3 py-2">
													<Badge variant="secondary">
														{member.role ?? "member"}
													</Badge>
												</td>
												<td className="px-3 py-2">
													<Badge
														variant={
															memberIsBanned ? "destructive" : "secondary"
														}
													>
														{memberIsBanned ? "Suspended" : "Active"}
													</Badge>
												</td>
												<td className="px-3 py-2">
													<div className="flex flex-wrap items-center gap-2">
														<Button
															type="button"
															variant="outline"
															className="h-10"
															onClick={(event) => {
																event.stopPropagation()
																openRoleDrawer(member)
															}}
															disabled={!canManageEmployeeRoles}
														>
															Role
														</Button>
														<ConfirmActionButton
															label={memberIsBanned ? "Unsuspend" : "Suspend"}
															confirmLabel={
																memberIsBanned ? "Unsuspend" : "Suspend"
															}
															title={
																memberIsBanned
																	? "Unsuspend employee"
																	: "Suspend employee"
															}
															description={
																memberIsBanned
																	? "Confirm you want to unsuspend this employee account."
																	: "Confirm you want to suspend this employee account."
															}
															onConfirm={() => {
																if (!userId) {
																	throw new Error(
																		"Unable to find employee account.",
																	)
																}

																return memberIsBanned
																	? unbanUserMutation.mutateAsync(userId)
																	: banUserMutation.mutateAsync(userId)
															}}
															variant="outline"
															disabled={!canRunPlatformAdminActions || !userId}
															isPending={
																banUserMutation.isPending ||
																unbanUserMutation.isPending
															}
															pendingLabel="Updating..."
															className="h-10"
															onTriggerClick={(event) =>
																event.stopPropagation()
															}
														/>
														<ConfirmActionButton
															label="Remove"
															confirmLabel="Remove"
															title="Remove employee"
															description="Confirm you want to remove this employee from the organization."
															onConfirm={() =>
																removeMemberMutation.mutateAsync(member.id)
															}
															variant="destructive"
															disabled={!canRemoveEmployees}
															isPending={removeMemberMutation.isPending}
															pendingLabel="Removing..."
															className="h-10"
															onTriggerClick={(event) =>
																event.stopPropagation()
															}
														/>
													</div>
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>
					</>
				) : null}
			</section>

			<ResponsiveDrawer
				open={isAddEmployeeDrawerOpen}
				onOpenChange={setIsAddEmployeeDrawerOpen}
				title="Invite employee"
				description="Send an organization invitation to this employee email."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="addEmployeeEmail">Employee email</FieldLabel>
							<Input
								id="addEmployeeEmail"
								type="email"
								value={addEmployeeEmail}
								onChange={(event) => setAddEmployeeEmail(event.target.value)}
								className="h-11"
								disabled={
									!canInviteEmployees || inviteEmployeeMutation.isPending
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="addEmployeeRole">Role</FieldLabel>
							<Select
								value={addEmployeeRole}
								onValueChange={setAddEmployeeRole}
								disabled={
									!canInviteEmployees || inviteEmployeeMutation.isPending
								}
							>
								<SelectTrigger id="addEmployeeRole" className="h-11 w-full">
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
							title="Send employee invitation"
							description="Confirm you want to invite this employee into the active organization."
							onConfirm={async () => {
								const trimmedEmail = addEmployeeEmail.trim()

								if (!trimmedEmail) {
									throw new Error("Employee email is required.")
								}

								await inviteEmployeeMutation.mutateAsync({
									email: trimmedEmail,
									role: addEmployeeRole,
								})
							}}
							disabled={!canInviteEmployees || !addEmployeeEmail.trim()}
							isPending={inviteEmployeeMutation.isPending}
							pendingLabel="Sending..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isRoleDrawerOpen}
				onOpenChange={setIsRoleDrawerOpen}
				title="Change employee role"
				description="Update this employee role for the active organization."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="roleTargetRole">Role</FieldLabel>
							<Select
								value={roleTargetRole}
								onValueChange={setRoleTargetRole}
								disabled={
									!canManageEmployeeRoles || updateMemberRoleMutation.isPending
								}
							>
								<SelectTrigger id="roleTargetRole" className="h-11 w-full">
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
							label="Apply role"
							confirmLabel="Apply"
							title="Apply employee role"
							description="Confirm you want to update this employee role."
							onConfirm={() => {
								if (!roleTargetMemberId) {
									throw new Error("Select an employee first.")
								}

								return updateMemberRoleMutation.mutateAsync({
									memberId: roleTargetMemberId,
									nextRole: roleTargetRole,
								})
							}}
							disabled={!canManageEmployeeRoles || !roleTargetMemberId}
							isPending={updateMemberRoleMutation.isPending}
							pendingLabel="Applying..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>
		</div>
	)
}
