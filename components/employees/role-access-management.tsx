"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { Separator } from "@/components/ui/separator"
import { employeesQueryKeys } from "@/features/employees/queries/keys"
import { mainQueryKeys } from "@/features/main/queries/keys"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { authClient } from "@/lib/auth-client"
import {
	defaultRolePolicyMap,
	mergePermissionRequirements,
	type Permission,
	permissionRequirements,
	resolvePermissionKeysFromStatements,
} from "@/lib/authorization/policies"
import { resolveErrorMessage } from "@/lib/errors"
import { feedbackMessageClassName } from "@/lib/theme-styles"

type OrganizationRoleRecord = {
	id?: string
	role: string
	permission?: Record<string, string[]>
}

type RoleCatalogEntry = {
	role: string
	policies: Permission[]
	isDefault: boolean
}

const permissionLabels: Record<Permission, string> = {
	viewDashboardModule: "View dashboard",
	viewEmployeesModule: "View employees",
	inviteEmployees: "Invite employees",
	manageEmployeeRoles: "Manage employee roles",
	removeEmployees: "Remove employees",
	viewBranchModule: "View branches",
	manageBranches: "Manage branches",
	manageLocationAccess: "Manage branch access",
	viewCustomerModule: "View customers",
	manageCustomers: "Manage customers",
	manageCustomerNotes: "Manage customer notes",
	viewFleetModule: "View fleet",
	manageVehicles: "Manage vehicles",
	viewBookingsModule: "View bookings",
	viewReportsModule: "View reports",
	managePaymentsModule: "Manage payments",
	manageBillingAttentionModule: "Manage billing attention",
	manageOrganizationSettings: "Manage organization settings",
	manageOrganizationVisibility: "Manage organization visibility",
	viewGalleryModule: "View gallery",
	manageGalleryMedia: "Manage gallery media",
}

const defaultRoleOrder = ["owner", "admin", "member"] as const

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

function sortRoleEntries(entries: RoleCatalogEntry[]): RoleCatalogEntry[] {
	return [...entries].sort((left, right) => {
		const leftDefaultIndex = defaultRoleOrder.indexOf(
			left.role as (typeof defaultRoleOrder)[number],
		)
		const rightDefaultIndex = defaultRoleOrder.indexOf(
			right.role as (typeof defaultRoleOrder)[number],
		)

		if (leftDefaultIndex !== -1 || rightDefaultIndex !== -1) {
			if (leftDefaultIndex === -1) return 1
			if (rightDefaultIndex === -1) return -1
			return leftDefaultIndex - rightDefaultIndex
		}

		return left.role.localeCompare(right.role)
	})
}

export function RoleAccessManagement() {
	const queryClient = useQueryClient()
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const permissionState = authContextQuery.data?.permissions
	const canManageEmployeeRoles = permissionState?.manageEmployeeRoles ?? false

	const permissionKeys = Object.keys(permissionRequirements) as Permission[]

	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
	const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)

	const [createRoleName, setCreateRoleName] = useState("")
	const [createPolicies, setCreatePolicies] = useState<Permission[]>([
		"viewDashboardModule",
	])

	const [selectedRoleName, setSelectedRoleName] = useState<string | null>(null)
	const [editRoleName, setEditRoleName] = useState("")
	const [editPolicies, setEditPolicies] = useState<Permission[]>([])

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

	const selectedRoleDetailsQuery = useQuery({
		queryKey: employeesQueryKeys.roleDetails(
			activeOrganizationId,
			selectedRoleName,
		),
		enabled: Boolean(
			activeOrganizationId && selectedRoleName && isEditDrawerOpen,
		),
		queryFn: async () => {
			if (!selectedRoleName) {
				throw new Error("Role name is required.")
			}

			const { data, error } = await authClient.organization.getRole({
				query: {
					organizationId: activeOrganizationId,
					roleName: selectedRoleName,
				},
			})

			if (error) {
				throw new Error(error.message ?? "Failed to load role details.")
			}

			if (!data) {
				throw new Error("Role details not found.")
			}

			return data as OrganizationRoleRecord
		},
	})

	const roleEntries = useMemo(() => {
		const entries = new Map<string, RoleCatalogEntry>()

		for (const [role, policies] of Object.entries(defaultRolePolicyMap)) {
			entries.set(role, {
				role,
				policies,
				isDefault: true,
			})
		}

		for (const roleRecord of rolesQuery.data ?? []) {
			if (!roleRecord.role) {
				continue
			}

			entries.set(roleRecord.role, {
				role: roleRecord.role,
				policies: resolvePermissionKeysFromStatements(roleRecord.permission),
				isDefault:
					roleRecord.role === "owner" ||
					roleRecord.role === "admin" ||
					roleRecord.role === "member",
			})
		}

		return sortRoleEntries([...entries.values()])
	}, [rolesQuery.data])

	const customRoles = roleEntries.filter((entry) => !entry.isDefault)

	async function invalidateRoleQueries() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: employeesQueryKeys.roles(activeOrganizationId),
			}),
			queryClient.invalidateQueries({ queryKey: mainQueryKeys.all }),
		])
	}

	const createRoleMutation = useMutation({
		mutationFn: async () => {
			const trimmedRoleName = createRoleName.trim()

			if (!trimmedRoleName) {
				throw new Error("Role name is required.")
			}

			if (createPolicies.length === 0) {
				throw new Error("Select at least one policy.")
			}

			const { error } = await authClient.organization.createRole({
				organizationId: activeOrganizationId,
				role: trimmedRoleName,
				permission: mergePermissionRequirements(createPolicies),
			})

			if (error) {
				throw new Error(error.message ?? "Failed to create role.")
			}
		},
		onSuccess: async () => {
			await invalidateRoleQueries()
			setMessage("Role created.")
			setError(null)
			setCreateRoleName("")
			setCreatePolicies(["viewDashboardModule"])
			setIsCreateDrawerOpen(false)
		},
		onError: (mutationError) => {
			setError(resolveErrorMessage(mutationError, "Failed to create role."))
			setMessage(null)
		},
	})

	const updateRoleMutation = useMutation({
		mutationFn: async () => {
			if (!selectedRoleName) {
				throw new Error("No role selected.")
			}

			const trimmedRoleName = editRoleName.trim()
			if (!trimmedRoleName) {
				throw new Error("Role name is required.")
			}

			if (editPolicies.length === 0) {
				throw new Error("Select at least one policy.")
			}

			const { error } = await authClient.organization.updateRole({
				organizationId: activeOrganizationId,
				roleName: selectedRoleName,
				data: {
					roleName:
						trimmedRoleName !== selectedRoleName ? trimmedRoleName : undefined,
					permission: mergePermissionRequirements(editPolicies),
				},
			})

			if (error) {
				throw new Error(error.message ?? "Failed to update role.")
			}
		},
		onSuccess: async () => {
			await invalidateRoleQueries()
			setMessage("Role updated.")
			setError(null)
			setIsEditDrawerOpen(false)
			setSelectedRoleName(null)
		},
		onError: (mutationError) => {
			setError(resolveErrorMessage(mutationError, "Failed to update role."))
			setMessage(null)
		},
	})

	const deleteRoleMutation = useMutation({
		mutationFn: async (roleName: string) => {
			const { error } = await authClient.organization.deleteRole({
				organizationId: activeOrganizationId,
				roleName,
			})

			if (error) {
				throw new Error(error.message ?? "Failed to delete role.")
			}
		},
		onSuccess: async () => {
			await invalidateRoleQueries()
			setMessage("Role deleted.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(resolveErrorMessage(mutationError, "Failed to delete role."))
			setMessage(null)
		},
	})

	function toggleCreatePolicy(policy: Permission) {
		setCreatePolicies((current) =>
			current.includes(policy)
				? current.filter((item) => item !== policy)
				: [...current, policy],
		)
	}

	function toggleEditPolicy(policy: Permission) {
		setEditPolicies((current) =>
			current.includes(policy)
				? current.filter((item) => item !== policy)
				: [...current, policy],
		)
	}

	function openEditRoleDrawer(roleName: string) {
		setSelectedRoleName(roleName)
		setIsEditDrawerOpen(true)
	}

	if (selectedRoleDetailsQuery.data && selectedRoleName) {
		const resolvedPolicies = resolvePermissionKeysFromStatements(
			selectedRoleDetailsQuery.data.permission,
		)

		if (editRoleName !== selectedRoleDetailsQuery.data.role) {
			setEditRoleName(selectedRoleDetailsQuery.data.role)
		}

		if (editPolicies.length === 0 && resolvedPolicies.length > 0) {
			setEditPolicies(resolvedPolicies)
		}
	}

	if (!activeOrganizationId) {
		return (
			<div className="max-w-6xl space-y-4">
				<PageSectionHeader
					title="Role & Access"
					description="Select an active organization first."
				/>
			</div>
		)
	}

	return (
		<div className="max-w-6xl space-y-8">
			<PageSectionHeader
				title="Role & Access"
				description="Manage custom roles and review role policy catalog for this organization."
				actions={
					<Button
						type="button"
						variant="outline"
						className="h-11"
						onClick={() => setIsCreateDrawerOpen(true)}
						disabled={!canManageEmployeeRoles}
					>
						Create role
					</Button>
				}
			/>

			{message ? (
				<p className={feedbackMessageClassName("success")}>{message}</p>
			) : null}
			{error ? <p className="text-destructive text-sm">{error}</p> : null}

			<section className="space-y-2">
				<div className="space-y-1">
					<h2 className="text-base font-semibold">Role management</h2>
					<p className="text-muted-foreground text-sm">
						Custom organization roles with confirmation-gated edits and deletes.
					</p>
				</div>
				<Separator />

				{rolesQuery.isPending ? (
					<p className="text-muted-foreground text-sm">Loading roles...</p>
				) : null}

				{customRoles.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No custom roles created.
					</p>
				) : null}

				<div className="space-y-3">
					{customRoles.map((roleEntry) => (
						<div
							key={roleEntry.role}
							className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
						>
							<div className="space-y-1">
								<p className="text-sm font-medium">{roleEntry.role}</p>
								<p className="text-muted-foreground text-xs">
									Policies: {roleEntry.policies.length}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2 md:justify-end">
								<Button
									type="button"
									variant="outline"
									className="h-10"
									onClick={() => openEditRoleDrawer(roleEntry.role)}
									disabled={!canManageEmployeeRoles}
								>
									Edit
								</Button>
								<ConfirmActionButton
									label="Delete"
									confirmLabel="Delete"
									title="Delete role"
									description="Confirm you want to delete this custom role."
									onConfirm={() =>
										deleteRoleMutation.mutateAsync(roleEntry.role)
									}
									variant="destructive"
									disabled={!canManageEmployeeRoles}
									isPending={deleteRoleMutation.isPending}
									pendingLabel="Deleting..."
									className="h-10"
								/>
							</div>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-2">
				<div className="space-y-1">
					<h2 className="text-base font-semibold">Role catalog</h2>
					<p className="text-muted-foreground text-sm">
						Default and custom role policy matrix.
					</p>
				</div>
				<Separator />

				<div className="space-y-3">
					{roleEntries.map((entry) => (
						<div key={entry.role} className="space-y-3 rounded-md border p-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-sm font-medium">{entry.role}</p>
								<Badge variant={entry.isDefault ? "secondary" : "default"}>
									{entry.isDefault ? "Default" : "Custom"}
								</Badge>
							</div>
							{entry.policies.length === 0 ? (
								<p className="text-muted-foreground text-xs">
									No policies assigned.
								</p>
							) : (
								<div className="flex flex-wrap gap-2">
									{entry.policies.map((policy) => (
										<Badge key={`${entry.role}-${policy}`} variant="outline">
											{permissionLabels[policy]}
										</Badge>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			</section>

			<ResponsiveDrawer
				open={isCreateDrawerOpen}
				onOpenChange={setIsCreateDrawerOpen}
				title="Create custom role"
				description="Add a role and assign permission policies."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="createRoleName">Role name</FieldLabel>
							<Input
								id="createRoleName"
								value={createRoleName}
								onChange={(event) => setCreateRoleName(event.target.value)}
								className="h-11"
								disabled={
									!canManageEmployeeRoles || createRoleMutation.isPending
								}
							/>
						</Field>
					</FieldGroup>

					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						{permissionKeys.map((permission) => (
							<Button
								key={permission}
								type="button"
								variant={
									createPolicies.includes(permission) ? "default" : "outline"
								}
								className="h-11 justify-start"
								disabled={!canManageEmployeeRoles}
								onClick={() => toggleCreatePolicy(permission)}
							>
								{permissionLabels[permission]}
							</Button>
						))}
					</div>

					<div className="flex justify-end">
						<ConfirmActionButton
							label="Create role"
							confirmLabel="Create"
							title="Create role"
							description="Confirm you want to create this custom role."
							onConfirm={() => createRoleMutation.mutateAsync()}
							disabled={!canManageEmployeeRoles}
							isPending={createRoleMutation.isPending}
							pendingLabel="Creating..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isEditDrawerOpen}
				onOpenChange={(open) => {
					setIsEditDrawerOpen(open)
					if (!open) {
						setSelectedRoleName(null)
						setEditRoleName("")
						setEditPolicies([])
					}
				}}
				title="Edit role"
				description="Update role name and policy selection."
			>
				<div className="space-y-5">
					{selectedRoleDetailsQuery.isPending ? (
						<p className="text-muted-foreground text-sm">
							Loading role details...
						</p>
					) : null}

					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="editRoleName">Role name</FieldLabel>
							<Input
								id="editRoleName"
								value={editRoleName}
								onChange={(event) => setEditRoleName(event.target.value)}
								className="h-11"
								disabled={
									!canManageEmployeeRoles || updateRoleMutation.isPending
								}
							/>
						</Field>
					</FieldGroup>

					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						{permissionKeys.map((permission) => (
							<Button
								key={permission}
								type="button"
								variant={
									editPolicies.includes(permission) ? "default" : "outline"
								}
								className="h-11 justify-start"
								disabled={!canManageEmployeeRoles}
								onClick={() => toggleEditPolicy(permission)}
							>
								{permissionLabels[permission]}
							</Button>
						))}
					</div>

					<div className="flex justify-end">
						<ConfirmActionButton
							label="Save role"
							confirmLabel="Save"
							title="Save role"
							description="Confirm you want to apply these role changes."
							onConfirm={() => updateRoleMutation.mutateAsync()}
							disabled={!canManageEmployeeRoles || !selectedRoleName}
							isPending={updateRoleMutation.isPending}
							pendingLabel="Saving..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>
		</div>
	)
}
