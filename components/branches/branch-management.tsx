"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useMemo, useState } from "react"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { branchesQueryKeys } from "@/features/branches/queries/keys"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { useIsMobile } from "@/hooks/use-mobile"
import { authClient } from "@/lib/auth-client"

type BranchRecord = {
	id: string
	name: string
	code: string
	address: string | null
	isActive: boolean
	createdAt: string
}

type BranchAccessRecord = {
	id: string
	branchId: string
	memberId: string
}

type BranchApiResponse = {
	branches: BranchRecord[]
	branchAccess: BranchAccessRecord[]
	canManageBranches: boolean
	canManageLocationAccess: boolean
}

type MemberUser = {
	name?: string | null
	email?: string | null
}

type MemberRecord = {
	id: string
	role?: string | null
	user?: MemberUser
}

export function BranchManagement() {
	const queryClient = useQueryClient()
	const isMobile = useIsMobile()
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined

	const [name, setName] = useState("")
	const [code, setCode] = useState("")
	const [address, setAddress] = useState("")
	const [formError, setFormError] = useState<string | null>(null)
	const [isCreateOverlayOpen, setIsCreateOverlayOpen] = useState(false)
	const [isEditOverlayOpen, setIsEditOverlayOpen] = useState(false)
	const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
	const [editName, setEditName] = useState("")
	const [editCode, setEditCode] = useState("")
	const [editAddress, setEditAddress] = useState("")
	const [editIsActive, setEditIsActive] = useState(true)
	const [editError, setEditError] = useState<string | null>(null)
	const [branchToDelete, setBranchToDelete] = useState<BranchRecord | null>(
		null,
	)
	const [selectedMemberByBranch, setSelectedMemberByBranch] = useState<
		Record<string, string>
	>({})

	const branchesQuery = useQuery({
		queryKey: branchesQueryKeys.list(activeOrganizationId),
		enabled: Boolean(activeOrganizationId),
		queryFn: async () => {
			const response = await fetch("/api/branches", { method: "GET" })

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load branches.")
			}

			return (await response.json()) as BranchApiResponse
		},
	})

	const membersQuery = useQuery({
		queryKey: branchesQueryKeys.members(activeOrganizationId),
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

			return (Array.isArray(data) ? data : []) as MemberRecord[]
		},
	})

	const createBranchMutation = useMutation({
		mutationFn: async (payload: {
			name: string
			code: string
			address: string
		}) => {
			const response = await fetch("/api/branches", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			})

			if (!response.ok) {
				const errorPayload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(errorPayload?.error ?? "Failed to create branch.")
			}
		},
		onSuccess: async () => {
			setName("")
			setCode("")
			setAddress("")
			setFormError(null)
			await queryClient.invalidateQueries({
				queryKey: branchesQueryKeys.list(activeOrganizationId),
			})
		},
		onError: (error) => {
			setFormError(error.message)
		},
	})

	const deleteBranchMutation = useMutation({
		mutationFn: async (branchId: string) => {
			const response = await fetch(`/api/branches/${branchId}`, {
				method: "DELETE",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to delete branch.")
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: branchesQueryKeys.list(activeOrganizationId),
			})
		},
	})

	const updateBranchMutation = useMutation({
		mutationFn: async (payload: {
			branchId: string
			name: string
			code: string
			address: string
			isActive: boolean
		}) => {
			const response = await fetch(`/api/branches/${payload.branchId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: payload.name,
					code: payload.code,
					address: payload.address,
					isActive: payload.isActive,
				}),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to update branch.")
			}
		},
		onSuccess: async () => {
			setEditError(null)
			setIsEditOverlayOpen(false)
			setEditingBranchId(null)
			await queryClient.invalidateQueries({
				queryKey: branchesQueryKeys.list(activeOrganizationId),
			})
		},
		onError: (error) => {
			setEditError(error.message)
		},
	})

	const grantAccessMutation = useMutation({
		mutationFn: async ({
			branchId,
			memberId,
		}: {
			branchId: string
			memberId: string
		}) => {
			const response = await fetch("/api/branches/access", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ branchId, memberId }),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to grant access.")
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: branchesQueryKeys.list(activeOrganizationId),
			})
		},
	})

	const revokeAccessMutation = useMutation({
		mutationFn: async ({
			branchId,
			memberId,
		}: {
			branchId: string
			memberId: string
		}) => {
			const response = await fetch("/api/branches/access", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ branchId, memberId }),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to revoke access.")
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: branchesQueryKeys.list(activeOrganizationId),
			})
		},
	})

	const isLoading = branchesQuery.isLoading || membersQuery.isLoading
	const branchData = branchesQuery.data
	const branches = branchData?.branches ?? []
	const branchAccess = branchData?.branchAccess ?? []
	const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])

	const canManageBranches = Boolean(branchData?.canManageBranches)
	const canManageLocationAccess = Boolean(branchData?.canManageLocationAccess)

	const nonOwnerMembers = useMemo(() => {
		return members.filter((nextMember) => nextMember.role !== "owner")
	}, [members])

	async function onCreateBranch(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		if (!canManageBranches) {
			setFormError("Your role cannot create branches.")
			return
		}

		const nextName = name.trim()
		const nextCode = code.trim().toUpperCase()

		if (!nextName || !nextCode) {
			setFormError("Branch name and code are required.")
			return
		}

		await createBranchMutation.mutateAsync({
			name: nextName,
			code: nextCode,
			address: address.trim(),
		})

		setIsCreateOverlayOpen(false)
	}

	function openEditBranchOverlay(nextBranch: BranchRecord) {
		setEditingBranchId(nextBranch.id)
		setEditName(nextBranch.name)
		setEditCode(nextBranch.code)
		setEditAddress(nextBranch.address ?? "")
		setEditIsActive(nextBranch.isActive)
		setEditError(null)
		setIsEditOverlayOpen(true)
	}

	async function onEditBranch(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		if (!editingBranchId) {
			setEditError("Select a branch first.")
			return
		}

		if (!canManageBranches) {
			setEditError("Your role cannot edit branches.")
			return
		}

		const nextName = editName.trim()
		const nextCode = editCode.trim().toUpperCase()

		if (!nextName || !nextCode) {
			setEditError("Branch name and code are required.")
			return
		}

		await updateBranchMutation.mutateAsync({
			branchId: editingBranchId,
			name: nextName,
			code: nextCode,
			address: editAddress.trim(),
			isActive: editIsActive,
		})
	}

	if (!activeOrganizationId) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Branch management</CardTitle>
					<CardDescription>
						Select an active organization first.
					</CardDescription>
				</CardHeader>
			</Card>
		)
	}

	const createFormContent = (
		<form onSubmit={onCreateBranch}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="branch-name">Branch name</FieldLabel>
					<Input
						id="branch-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Colombo Central"
						className="h-11"
						disabled={!canManageBranches}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor="branch-code">Code</FieldLabel>
					<Input
						id="branch-code"
						value={code}
						onChange={(event) => setCode(event.target.value)}
						placeholder="CMB-C"
						className="h-11"
						disabled={!canManageBranches}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor="branch-address">Address</FieldLabel>
					<Input
						id="branch-address"
						value={address}
						onChange={(event) => setAddress(event.target.value)}
						placeholder="Address (optional)"
						className="h-11"
						disabled={!canManageBranches}
					/>
				</Field>

				{formError ? (
					<p className="text-destructive text-sm">{formError}</p>
				) : null}
				{!canManageBranches ? (
					<p className="text-muted-foreground text-sm">
						Your role is read-only for branch setup.
					</p>
				) : null}

				<Button
					type="submit"
					className="h-11 w-full"
					disabled={createBranchMutation.isPending || !canManageBranches}
				>
					{createBranchMutation.isPending
						? "Creating branch..."
						: "Create branch"}
				</Button>
			</FieldGroup>
		</form>
	)

	const editFormContent = (
		<form onSubmit={onEditBranch}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="edit-branch-name">Branch name</FieldLabel>
					<Input
						id="edit-branch-name"
						value={editName}
						onChange={(event) => setEditName(event.target.value)}
						className="h-11"
						disabled={!canManageBranches}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor="edit-branch-code">Code</FieldLabel>
					<Input
						id="edit-branch-code"
						value={editCode}
						onChange={(event) => setEditCode(event.target.value)}
						className="h-11"
						disabled={!canManageBranches}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor="edit-branch-address">Address</FieldLabel>
					<Input
						id="edit-branch-address"
						value={editAddress}
						onChange={(event) => setEditAddress(event.target.value)}
						className="h-11"
						disabled={!canManageBranches}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor="edit-branch-status">Status</FieldLabel>
					<Select
						value={editIsActive ? "active" : "inactive"}
						onValueChange={(value) => setEditIsActive(value === "active")}
						disabled={!canManageBranches}
					>
						<SelectTrigger id="edit-branch-status" className="h-11 w-full">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="inactive">Inactive</SelectItem>
						</SelectContent>
					</Select>
				</Field>

				{editError ? (
					<p className="text-destructive text-sm">{editError}</p>
				) : null}

				<Button
					type="submit"
					className="h-11 w-full"
					disabled={updateBranchMutation.isPending || !canManageBranches}
				>
					{updateBranchMutation.isPending ? "Saving branch..." : "Save branch"}
				</Button>
			</FieldGroup>
		</form>
	)

	return (
		<div className="space-y-4">
			<PageSectionHeader
				title="Branch management"
				description="Create, edit, and control location-scoped branch operations."
				actions={
					<Button
						className="h-11"
						onClick={() => {
							setFormError(null)
							setIsCreateOverlayOpen(true)
						}}
						disabled={!canManageBranches}
					>
						Create branch
					</Button>
				}
			/>

			<div className="grid gap-3 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs">Branches</p>
						<p className="mt-1 text-2xl font-semibold">{branches.length}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs">Active</p>
						<p className="mt-1 text-2xl font-semibold">
							{branches.filter((nextBranch) => nextBranch.isActive).length}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs">Scoped members</p>
						<p className="mt-1 text-2xl font-semibold">{branchAccess.length}</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Accessible branches</CardTitle>
						<CardDescription>
							Branches available to your role within the active organization.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{isLoading ? (
							<p className="text-muted-foreground text-sm">
								Loading branches...
							</p>
						) : null}
						{!isLoading && branches.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No branches available.
							</p>
						) : null}

						{branches.map((nextBranch) => (
							<div
								key={nextBranch.id}
								className="space-y-3 rounded-md border p-3"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="space-y-1">
										<p className="text-sm font-medium">{nextBranch.name}</p>
										<p className="text-muted-foreground text-xs">
											Code: {nextBranch.code}
										</p>
										{nextBranch.address ? (
											<p className="text-muted-foreground text-xs">
												{nextBranch.address}
											</p>
										) : null}
									</div>
									<Badge
										variant={nextBranch.isActive ? "default" : "secondary"}
									>
										{nextBranch.isActive ? "Active" : "Inactive"}
									</Badge>
								</div>

								<div className="flex flex-wrap gap-2">
									{canManageBranches ? (
										<>
											<Button
												variant="outline"
												className="h-11"
												onClick={() => openEditBranchOverlay(nextBranch)}
											>
												Edit
											</Button>
											<Button
												variant="outline"
												className="h-11"
												disabled={deleteBranchMutation.isPending}
												onClick={() => setBranchToDelete(nextBranch)}
											>
												Delete
											</Button>
										</>
									) : null}
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Location-scoped access</CardTitle>
						<CardDescription>
							Grant or revoke branch access for member/admin roles.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{!canManageLocationAccess ? (
							<p className="text-muted-foreground text-sm">
								Your role is read-only for location access management.
							</p>
						) : null}

						{branches.map((nextBranch) => {
							const branchMappings = branchAccess.filter(
								(mapping) => mapping.branchId === nextBranch.id,
							)

							return (
								<div
									key={nextBranch.id}
									className="space-y-3 rounded-md border p-3"
								>
									<p className="text-sm font-medium">{nextBranch.name}</p>

									<div className="flex flex-col gap-2 md:flex-row">
										<Select
											value={selectedMemberByBranch[nextBranch.id]}
											onValueChange={(value) =>
												setSelectedMemberByBranch((previous) => ({
													...previous,
													[nextBranch.id]: value,
												}))
											}
											disabled={!canManageLocationAccess}
										>
											<SelectTrigger className="h-11 w-full md:w-80">
												<SelectValue placeholder="Select member" />
											</SelectTrigger>
											<SelectContent>
												{nonOwnerMembers.map((nextMember) => (
													<SelectItem key={nextMember.id} value={nextMember.id}>
														{`${
															nextMember.user?.name ??
															nextMember.user?.email ??
															"Member"
														} (${nextMember.role ?? "member"})`}
													</SelectItem>
												))}
											</SelectContent>
										</Select>

										<Button
											className="h-11"
											disabled={
												!canManageLocationAccess ||
												grantAccessMutation.isPending ||
												!selectedMemberByBranch[nextBranch.id]
											}
											onClick={() =>
												grantAccessMutation.mutate({
													branchId: nextBranch.id,
													memberId: selectedMemberByBranch[nextBranch.id],
												})
											}
										>
											Grant access
										</Button>
									</div>

									<div className="space-y-2">
										{branchMappings.length === 0 ? (
											<p className="text-muted-foreground text-xs">
												No scoped members assigned.
											</p>
										) : null}

										{branchMappings.map((mapping) => {
											const assignedMember = members.find(
												(nextMember) => nextMember.id === mapping.memberId,
											)

											return (
												<div
													key={mapping.id}
													className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
												>
													<p className="text-sm">
														{assignedMember?.user?.email ?? "Unknown member"}
													</p>
													<Button
														variant="outline"
														className="h-11 w-full sm:w-auto"
														disabled={
															!canManageLocationAccess ||
															revokeAccessMutation.isPending
														}
														onClick={() =>
															revokeAccessMutation.mutate({
																branchId: nextBranch.id,
																memberId: mapping.memberId,
															})
														}
													>
														Revoke
													</Button>
												</div>
											)
										})}
									</div>
								</div>
							)
						})}
					</CardContent>
				</Card>
			</div>

			{isMobile ? (
				<Sheet open={isCreateOverlayOpen} onOpenChange={setIsCreateOverlayOpen}>
					<SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
						<SheetHeader>
							<SheetTitle>Create branch</SheetTitle>
							<SheetDescription>
								Set up locations used for branch-scoped operations.
							</SheetDescription>
						</SheetHeader>

						<div className="p-4 pt-0">{createFormContent}</div>
					</SheetContent>
				</Sheet>
			) : (
				<Dialog
					open={isCreateOverlayOpen}
					onOpenChange={setIsCreateOverlayOpen}
				>
					<DialogContent className="sm:max-w-xl">
						<DialogHeader>
							<DialogTitle>Create branch</DialogTitle>
							<DialogDescription>
								Set up locations used for branch-scoped operations.
							</DialogDescription>
						</DialogHeader>

						{createFormContent}
					</DialogContent>
				</Dialog>
			)}

			{isMobile ? (
				<Sheet open={isEditOverlayOpen} onOpenChange={setIsEditOverlayOpen}>
					<SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
						<SheetHeader>
							<SheetTitle>Edit branch</SheetTitle>
							<SheetDescription>
								Update branch details and status.
							</SheetDescription>
						</SheetHeader>

						<div className="p-4 pt-0">{editFormContent}</div>
					</SheetContent>
				</Sheet>
			) : (
				<Dialog open={isEditOverlayOpen} onOpenChange={setIsEditOverlayOpen}>
					<DialogContent className="sm:max-w-xl">
						<DialogHeader>
							<DialogTitle>Edit branch</DialogTitle>
							<DialogDescription>
								Update branch details and status.
							</DialogDescription>
						</DialogHeader>

						{editFormContent}
					</DialogContent>
				</Dialog>
			)}

			<AlertDialog
				open={Boolean(branchToDelete)}
				onOpenChange={(open) => {
					if (!open) {
						setBranchToDelete(null)
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete branch</AlertDialogTitle>
						<AlertDialogDescription>
							{branchToDelete
								? `This permanently removes ${branchToDelete.name} from the organization.`
								: "This action cannot be undone."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (!branchToDelete) {
									return
								}

								deleteBranchMutation.mutate(branchToDelete.id, {
									onSuccess: async () => {
										setBranchToDelete(null)
										await queryClient.invalidateQueries({
											queryKey: branchesQueryKeys.list(activeOrganizationId),
										})
									},
								})
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
