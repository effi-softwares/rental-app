"use client"

import { ChevronsUpDown, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FormEvent, useRef, useState } from "react"

import type { OrganizationLogoPickerHandle } from "@/components/organizations/organization-logo-picker"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar"
import { useCreateOrganizationMutation } from "@/features/main/mutations/use-create-organization-mutation"
import { useSetActiveOrganizationMutation } from "@/features/main/mutations/use-set-active-organization-mutation"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { toSlug } from "@/lib/utils"
import { WorkspaceCreateOrganizationDialog } from "./workspace-create-organization-dialog"

function getOrganizationInitials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean)

	if (parts.length === 0) {
		return "OR"
	}

	const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "")
	return initials.join("") || "OR"
}

export function OrganizationSwitcher() {
	const router = useRouter()
	const { isMobile } = useSidebar()
	const authContextQuery = useAuthContextQuery()
	const setActiveOrganizationMutation = useSetActiveOrganizationMutation()
	const createOrganizationMutation = useCreateOrganizationMutation()

	const [isDropdownOpen, setIsDropdownOpen] = useState(false)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [newOrganizationName, setNewOrganizationName] = useState("")
	const [createOrganizationError, setCreateOrganizationError] = useState<
		string | null
	>(null)
	const logoPickerRef = useRef<OrganizationLogoPickerHandle | null>(null)

	const organizations = authContextQuery.data?.accessibleOrganizations ?? []
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? ""
	const viewerRole = authContextQuery.data?.viewer.role ?? "member"
	const isLoadingOrganizations = authContextQuery.isPending
	const isCreatingOrganization = createOrganizationMutation.isPending
	const activeOrganization =
		organizations.find(
			(organization) => organization.id === activeOrganizationId,
		) ?? organizations[0]

	function handleCreateDialogOpenChange(isOpen: boolean) {
		setIsCreateDialogOpen(isOpen)

		if (!isOpen) {
			setCreateOrganizationError(null)
		}
	}

	async function onOrganizationChange(organizationId: string) {
		await setActiveOrganizationMutation.mutateAsync(organizationId)
		router.refresh()
	}

	async function onCreateOrganization(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		const trimmedName = newOrganizationName.trim()
		const slug = toSlug(trimmedName)

		if (!trimmedName || !slug) {
			setCreateOrganizationError("Organization name is required.")
			return
		}

		setCreateOrganizationError(null)

		try {
			const logoResult = await logoPickerRef.current?.resolveLogo()

			if (!logoResult?.logoUrl) {
				setCreateOrganizationError(
					"Please choose or upload an organization logo.",
				)
				return
			}

			await createOrganizationMutation.mutateAsync({
				name: trimmedName,
				slug,
				logo: logoResult.logoUrl,
				logoBlurDataUrl: logoResult.blurDataUrl,
			})
			setNewOrganizationName("")
			setIsCreateDialogOpen(false)
			router.refresh()
		} catch (error) {
			setCreateOrganizationError(
				error instanceof Error
					? error.message
					: "Unable to create organization. Please try again.",
			)
		}
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="size-8 rounded-lg">
								<AvatarImage
									src={activeOrganization?.logo ?? undefined}
									alt={activeOrganization?.name ?? "Organization"}
								/>
								<AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground rounded-lg text-xs font-semibold">
									{getOrganizationInitials(activeOrganization?.name ?? "")}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">
									{isLoadingOrganizations
										? "Loading organizations..."
										: (activeOrganization?.name ?? "Select organization")}
								</span>
								<span className="truncate text-xs">
									{activeOrganization?.slug ?? ""}
								</span>
							</div>
							<ChevronsUpDown className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						align="start"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuLabel className="text-muted-foreground text-xs">
							Organizations
						</DropdownMenuLabel>
						{organizations.map((organization, index) => (
							<DropdownMenuItem
								key={organization.id}
								onClick={() => {
									void onOrganizationChange(organization.id)
								}}
								className="gap-2 p-2"
							>
								<Avatar className="size-6 rounded-md border">
									<AvatarImage
										src={organization.logo ?? undefined}
										alt={organization.name}
									/>
									<AvatarFallback className="rounded-md text-[10px] font-semibold">
										{getOrganizationInitials(organization.name)}
									</AvatarFallback>
								</Avatar>
								{organization.name}
								<DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
							</DropdownMenuItem>
						))}
						{viewerRole === "owner" ? (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={(event) => {
										event.preventDefault()
										setIsDropdownOpen(false)
										handleCreateDialogOpenChange(true)
									}}
									className="gap-2 p-2"
								>
									<div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
										<Plus className="size-4" />
									</div>
									<span className="text-muted-foreground font-medium">
										Add New Organization
									</span>
								</DropdownMenuItem>
							</>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>

				<WorkspaceCreateOrganizationDialog
					isOpen={isCreateDialogOpen}
					onOpenChange={handleCreateDialogOpenChange}
					newOrganizationName={newOrganizationName}
					onNewOrganizationNameChange={setNewOrganizationName}
					createOrganizationError={createOrganizationError}
					onResetCreateOrganizationError={() =>
						setCreateOrganizationError(null)
					}
					isCreatingOrganization={isCreatingOrganization}
					logoPickerRef={logoPickerRef}
					onCreateOrganization={(event) => {
						void onCreateOrganization(event)
					}}
				/>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
