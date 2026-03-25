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
	role: string
}

type AdminUserRecord = {
	id: string
	name?: string | null
	email?: string | null
	banned?: boolean | null
	role?: string | null
	createdAt?: string | Date | null
	updatedAt?: string | Date | null
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

type EmployeeDetailsProps = {
	memberId: string
}

export function EmployeeDetails({ memberId }: EmployeeDetailsProps) {
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
	const [isRoleDrawerOpen, setIsRoleDrawerOpen] = useState(false)
	const [nextRole, setNextRole] = useState("member")

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
	const member = members.find((item) => item.id === memberId)
	const userId = member?.userId ?? member?.user?.id

	const viewerMemberRole = useMemo(() => {
		const sessionUserId = session.data?.user?.id
		const sessionMember = members.find(
			(item) =>
				item.userId === sessionUserId || item.user?.id === sessionUserId,
		)

		if (sessionMember?.role) {
			return sessionMember.role.toLowerCase()
		}

		return "member"
	}, [members, session.data?.user?.id])

	const canTakeEmployeeActions = viewerMemberRole === "owner"
	const canRunPlatformAdminActions = canTakeEmployeeActions && canUseAdminApis
	const canManageEmployeeRoles =
		(permissionState?.manageEmployeeRoles ?? false) && canTakeEmployeeActions
	const canRemoveEmployees =
		(permissionState?.removeEmployees ?? false) && canTakeEmployeeActions

	const availableRoles = useMemo(() => {
		const dynamicRoles = (rolesQuery.data ?? [])
			.map((roleRecord) => roleRecord.role)
			.filter((roleName): roleName is string => Boolean(roleName))

		return [...new Set(["member", "admin", "owner", ...dynamicRoles])]
	}, [rolesQuery.data])

	const employeeDetailsQuery = useQuery({
		queryKey: employeesQueryKeys.employeeDetails(
			activeOrganizationId,
			memberId,
		),
		enabled: Boolean(activeOrganizationId && memberId && canUseAdminApis),
		queryFn: async () => {
			if (!userId) {
				throw new Error("Unable to load employee details.")
			}

			const { data, error } = await authClient.admin.getUser({
				query: {
					id: userId,
				},
			})

			if (error) {
				throw new Error(error.message ?? "Failed to load employee details.")
			}

			if (!data) {
				throw new Error("Employee details not found.")
			}

			if (typeof data === "object" && data !== null && "user" in data) {
				return (data as { user: AdminUserRecord }).user
			}

			return data as AdminUserRecord
		},
	})

	async function invalidateEmployeeQueries() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: employeesQueryKeys.members(activeOrganizationId),
			}),
			queryClient.invalidateQueries({
				queryKey: employeesQueryKeys.employeeDetails(
					activeOrganizationId,
					memberId,
				),
			}),
			queryClient.invalidateQueries({ queryKey: mainQueryKeys.all }),
		])
	}

	const updateMemberRoleMutation = useMutation({
		mutationFn: async () => {
			if (!member) {
				throw new Error("Employee not found.")
			}

			const { error } = await authClient.organization.updateMemberRole({
				memberId: member.id,
				role: nextRole,
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
		},
		onError: (mutationError) => {
			setError(
				resolveErrorMessage(mutationError, "Failed to update member role."),
			)
			setMessage(null)
		},
	})

	const removeMemberMutation = useMutation({
		mutationFn: async () => {
			if (!member) {
				throw new Error("Employee not found.")
			}

			const { error } = await authClient.organization.removeMember({
				memberIdOrEmail: member.id,
				organizationId: activeOrganizationId,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to remove member.")
			}
		},
		onSuccess: async () => {
			await invalidateEmployeeQueries()
			window.location.href = routes.app.employees
		},
		onError: (mutationError) => {
			setError(resolveErrorMessage(mutationError, "Failed to remove member."))
			setMessage(null)
		},
	})

	const banUserMutation = useMutation({
		mutationFn: async () => {
			if (!canUseAdminApis || !userId) {
				throw new Error("Platform admin access is required.")
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
		mutationFn: async () => {
			if (!canUseAdminApis || !userId) {
				throw new Error("Platform admin access is required.")
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

	const impersonateUserMutation = useMutation({
		mutationFn: async () => {
			if (!canUseAdminApis || !userId) {
				throw new Error("Platform admin access is required.")
			}

			const { error } = await authClient.admin.impersonateUser({
				userId,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to impersonate employee.")
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: mainQueryKeys.all })
			setMessage("Impersonation session started.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(
				resolveErrorMessage(mutationError, "Failed to impersonate employee."),
			)
			setMessage(null)
		},
	})

	const deleteUserMutation = useMutation({
		mutationFn: async () => {
			if (!canUseAdminApis || !userId) {
				throw new Error("Platform admin access is required.")
			}

			const { error } = await authClient.admin.removeUser({
				userId,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to delete employee account.")
			}
		},
		onSuccess: async () => {
			await invalidateEmployeeQueries()
			window.location.href = routes.app.employees
		},
		onError: (mutationError) => {
			setError(
				resolveErrorMessage(
					mutationError,
					"Failed to delete employee account.",
				),
			)
			setMessage(null)
		},
	})

	if (!activeOrganizationId) {
		return (
			<div className="max-w-4xl space-y-4">
				<PageSectionHeader
					title="Employee details"
					description="Select an active organization first."
				/>
			</div>
		)
	}

	if (membersQuery.isPending) {
		return (
			<div className="max-w-4xl space-y-4">
				<PageSectionHeader
					title="Employee details"
					description="Loading employee details..."
				/>
			</div>
		)
	}

	if (membersQuery.isError || !member) {
		return (
			<div className="max-w-4xl space-y-4">
				<PageSectionHeader
					title="Employee details"
					description="Employee record could not be loaded."
				/>
				<p className="text-destructive text-sm">
					{resolveErrorMessage(membersQuery.error, "Failed to load employee.")}
				</p>
				<Button asChild variant="outline" className="h-11">
					<Link href={routes.app.employees}>Back to employees</Link>
				</Button>
			</div>
		)
	}

	const isBanned = Boolean(
		member.user?.banned || employeeDetailsQuery.data?.banned,
	)

	return (
		<div className="max-w-4xl space-y-8">
			<PageSectionHeader
				title="Employee details"
				description="Manage profile data and access actions for this employee."
				actions={
					<Button asChild variant="outline" className="h-11">
						<Link href={routes.app.employees}>Back to employees</Link>
					</Button>
				}
			/>

			{message ? (
				<p className={feedbackMessageClassName("success")}>{message}</p>
			) : null}
			{error ? <p className="text-destructive text-sm">{error}</p> : null}

			<section className="space-y-2">
				<div className="space-y-1">
					<h2 className="text-base font-semibold">Basic details</h2>
				</div>
				<Separator />

				<div className="space-y-0">
					<div className="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
						<p className="text-sm font-medium">Name</p>
						<p className="text-muted-foreground text-sm">
							{member.user?.name ?? "Unnamed user"}
						</p>
					</div>
					<Separator />
					<div className="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
						<p className="text-sm font-medium">Email</p>
						<p className="text-muted-foreground text-sm">
							{member.user?.email ?? "-"}
						</p>
					</div>
					<Separator />
					<div className="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
						<p className="text-sm font-medium">Role</p>
						<Badge variant="secondary">{member.role ?? "member"}</Badge>
					</div>
					<Separator />
					<div className="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
						<p className="text-sm font-medium">Status</p>
						<Badge variant={isBanned ? "destructive" : "secondary"}>
							{isBanned ? "Suspended" : "Active"}
						</Badge>
					</div>
					<Separator />
					<div className="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
						<p className="text-sm font-medium">Created</p>
						<p className="text-muted-foreground text-sm">
							{formatDate(employeeDetailsQuery.data?.createdAt)}
						</p>
					</div>
				</div>
			</section>

			<section className="space-y-2">
				<div className="space-y-1">
					<h2 className="text-base font-semibold">Actions</h2>
					<p className="text-muted-foreground text-sm">
						Every action requires confirmation.
					</p>
				</div>
				<Separator />

				<div className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => {
								setNextRole(member.role ?? "member")
								setIsRoleDrawerOpen(true)
							}}
							disabled={!canManageEmployeeRoles}
						>
							Change role
						</Button>
						<ConfirmActionButton
							label={isBanned ? "Unsuspend" : "Suspend"}
							confirmLabel={isBanned ? "Unsuspend" : "Suspend"}
							title={isBanned ? "Unsuspend employee" : "Suspend employee"}
							description={
								isBanned
									? "Confirm you want to unsuspend this employee account."
									: "Confirm you want to suspend this employee account."
							}
							onConfirm={() =>
								isBanned
									? unbanUserMutation.mutateAsync()
									: banUserMutation.mutateAsync()
							}
							variant="outline"
							disabled={!canRunPlatformAdminActions || !userId}
							isPending={
								banUserMutation.isPending || unbanUserMutation.isPending
							}
							pendingLabel="Updating..."
						/>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<ConfirmActionButton
							label="Impersonate"
							confirmLabel="Start"
							title="Impersonate employee"
							description="Confirm you want to start an impersonation session for this employee."
							onConfirm={() => impersonateUserMutation.mutateAsync()}
							variant="outline"
							disabled={!canRunPlatformAdminActions || !userId}
							isPending={impersonateUserMutation.isPending}
							pendingLabel="Starting..."
						/>
						<ConfirmActionButton
							label="Remove from organization"
							confirmLabel="Remove"
							title="Remove employee"
							description="Confirm you want to remove this employee from the organization."
							onConfirm={() => removeMemberMutation.mutateAsync()}
							variant="destructive"
							disabled={!canRemoveEmployees}
							isPending={removeMemberMutation.isPending}
							pendingLabel="Removing..."
						/>
					</div>

					<ConfirmActionButton
						label="Delete account"
						confirmLabel="Delete"
						title="Delete employee account"
						description="Confirm you want to permanently delete this employee account."
						onConfirm={() => deleteUserMutation.mutateAsync()}
						variant="destructive"
						disabled={!canRunPlatformAdminActions || !userId}
						isPending={deleteUserMutation.isPending}
						pendingLabel="Deleting..."
						className="h-11 w-full sm:w-auto"
					/>
				</div>
			</section>

			<ResponsiveDrawer
				open={isRoleDrawerOpen}
				onOpenChange={setIsRoleDrawerOpen}
				title="Change employee role"
				description="Update this employee role for the active organization."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="detailsRoleSelect">Role</FieldLabel>
							<Select
								value={nextRole}
								onValueChange={setNextRole}
								disabled={
									!canManageEmployeeRoles || updateMemberRoleMutation.isPending
								}
							>
								<SelectTrigger id="detailsRoleSelect" className="h-11 w-full">
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
							onConfirm={() => updateMemberRoleMutation.mutateAsync()}
							disabled={!canManageEmployeeRoles}
							isPending={updateMemberRoleMutation.isPending}
							pendingLabel="Applying..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>
		</div>
	)
}
